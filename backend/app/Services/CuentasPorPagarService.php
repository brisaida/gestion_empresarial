<?php

namespace App\Services;

use App\Models\Compra;
use App\Models\Empresa;
use App\Models\PagoCompra;
use App\Models\Proveedor;
use Carbon\Carbon;
use DomainException;

/**
 * Compras al crédito: condición de la compra y pagos a proveedores.
 * Los métodos que escriben deben llamarse dentro de DB::transaction().
 */
class CuentasPorPagarService
{
    public const METODOS_CONTADO = ['efectivo', 'debito', 'tarjeta', 'transferencia', 'cheque'];
    public const METODOS_PAGO    = ['efectivo', 'debito', 'tarjeta', 'transferencia', 'cheque'];

    /** Plazo que da un proveedor: el suyo, o el de la empresa, o 30 días. */
    public static function diasPara(?Proveedor $proveedor, ?Empresa $empresa): int
    {
        return (int) ($proveedor?->dias_credito ?? $empresa?->dias_credito ?? CreditoService::DIAS_POR_DEFECTO);
    }

    /** Campos de condición para Compra::create() / update(). */
    public function datosCompra(
        int $empresaId,
        ?int $proveedorId,
        float $total,
        string $fechaCompra,
        ?string $condicion,
        ?int $dias = null,
        ?string $metodoPago = null,
        ?int $tarjetaId = null,
    ): array {
        if ($condicion !== 'credito') {
            $metodo  = $metodoPago ?: 'efectivo';
            $tarjeta = $metodo === TarjetaService::METODO ? app(TarjetaService::class)->validar($empresaId, $tarjetaId) : null;
            return [
                'condicion'         => 'contado',
                'metodo_pago'       => $metodo,
                'tarjeta_credito_id' => $tarjeta?->id,
                'dias_credito'      => null,
                'fecha_vencimiento' => null,
                'saldo_pendiente'   => 0,
            ];
        }

        $proveedor = $proveedorId ? Proveedor::where('empresa_id', $empresaId)->find($proveedorId) : null;
        if (! $proveedor) {
            throw new DomainException('Para comprar al crédito selecciona el proveedor.');
        }

        $dias = $dias ?? self::diasPara($proveedor, Empresa::find($empresaId));

        return [
            'condicion'         => 'credito',
            'metodo_pago'       => null,
            'tarjeta_credito_id' => null,
            'dias_credito'      => $dias,
            'fecha_vencimiento' => Carbon::parse($fechaCompra)->addDays($dias)->toDateString(),
            'saldo_pendiente'   => round($total, 4),
        ];
    }

    /**
     * Cambia la condición de una compra ya registrada (p. ej. una que se ingresó
     * antes de existir el crédito). No se permite si ya tiene pagos vigentes.
     */
    public function cambiarCondicion(Compra $compra, ?string $condicion, ?int $dias, ?string $metodoPago, ?int $tarjetaId = null, ?int $usuarioId = null, ?int $cuentaId = null): Compra
    {
        $compra = Compra::lockForUpdate()->findOrFail($compra->id);

        if ($compra->estado === 'cancelada') {
            throw new DomainException('La compra está cancelada.');
        }
        if ($compra->pagos()->where('anulado', false)->exists()) {
            throw new DomainException('La compra tiene pagos registrados. Anúlalos antes de cambiar la condición.');
        }
        if ($compra->devoluciones()->exists()) {
            throw new DomainException('La compra tiene devoluciones registradas; ya no se puede cambiar la condición.');
        }

        $compra->update($this->datosCompra(
            $compra->empresa_id, $compra->proveedor_id, (float) $compra->total,
            $compra->fecha_compra->toDateString(), $condicion, $dias, $metodoPago, $tarjetaId,
        ));
        app(TarjetaService::class)->sincronizarCompra($compra, $usuarioId ?? $compra->usuario_id);
        app(BancoService::class)->sincronizarCompra($compra, $cuentaId, $usuarioId ?? $compra->usuario_id);

        return $compra;
    }

    /** @throws DomainException */
    public function registrarPago(Compra $compra, array $datos, int $usuarioId): PagoCompra
    {
        $compra = Compra::lockForUpdate()->findOrFail($compra->id);

        if (! $compra->esCredito()) {
            throw new DomainException('Solo se registran pagos a compras al crédito.');
        }
        if ($compra->estado === 'cancelada') {
            throw new DomainException('La compra está cancelada.');
        }

        $saldo = round((float) $compra->saldo_pendiente, 2);
        $monto = round((float) $datos['monto'], 2);

        if ($saldo <= 0) {
            throw new DomainException("La factura {$compra->numero_factura} ya está pagada.");
        }
        if ($monto > $saldo) {
            throw new DomainException(sprintf('El pago (L %s) es mayor que el saldo de la factura (L %s).',
                number_format($monto, 2), number_format($saldo, 2)));
        }

        $metodo  = $datos['metodo_pago'] ?? 'transferencia';
        $tarjeta = $metodo === TarjetaService::METODO
            ? app(TarjetaService::class)->validar($compra->empresa_id, $datos['tarjeta_credito_id'] ?? null)
            : null;

        $pago = PagoCompra::create([
            'empresa_id'    => $compra->empresa_id,
            'compra_id'     => $compra->id,
            'proveedor_id'  => $compra->proveedor_id,
            'usuario_id'    => $usuarioId,
            'fecha'         => $datos['fecha'] ?? today()->toDateString(),
            'monto'         => $monto,
            'metodo_pago'   => $metodo,
            // Solo el efectivo puede salir de la caja
            'desde_caja'    => $metodo === 'efectivo' && (bool) ($datos['desde_caja'] ?? false),
            'referencia'    => $datos['referencia'] ?? null,
            'observaciones' => $datos['observaciones'] ?? null,
            'tarjeta_credito_id' => $tarjeta?->id,
        ]);
        app(TarjetaService::class)->cargarPagoProveedor($pago, $usuarioId);
        app(BancoService::class)->registrarPagoCompra($pago, $datos['cuenta_bancaria_id'] ?? null, $usuarioId);

        $compra->update(['saldo_pendiente' => max(0, round((float) $compra->saldo_pendiente - $monto, 4))]);

        return $pago;
    }

    /** @throws DomainException */
    public function anularPago(PagoCompra $pago, int $usuarioId): PagoCompra
    {
        $pago = PagoCompra::lockForUpdate()->findOrFail($pago->id);
        if ($pago->anulado) {
            throw new DomainException('El pago ya está anulado.');
        }

        $compra = Compra::lockForUpdate()->findOrFail($pago->compra_id);
        if ($compra->estado === 'cancelada') {
            throw new DomainException('La compra está cancelada.');
        }

        $pago->update(['anulado' => true, 'anulado_por' => $usuarioId, 'anulado_at' => now()]);
        app(TarjetaService::class)->anularPorPagoProveedor($pago);
        app(BancoService::class)->anularPor('pago_compra_id', $pago->id);
        $tope = (float) $compra->total - (float) $compra->devuelto_a_saldo;
        $compra->update(['saldo_pendiente' => min($tope, round((float) $compra->saldo_pendiente + (float) $pago->monto, 4))]);

        return $pago;
    }
}
