<?php

namespace App\Services;

use App\Models\AbonoVenta;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\Venta;
use Carbon\Carbon;
use DomainException;

/**
 * Ventas al crédito: condición de la venta, límite del cliente y abonos.
 * Todos los métodos que escriben deben llamarse dentro de DB::transaction().
 */
class CreditoService
{
    public const DIAS_POR_DEFECTO = 30;

    /** Plazo que aplica a un cliente: el suyo, o el de la empresa, o 30 días. */
    public static function diasPara(?Cliente $cliente, ?Empresa $empresa): int
    {
        return (int) ($cliente?->dias_credito ?? $empresa?->dias_credito ?? self::DIAS_POR_DEFECTO);
    }

    /**
     * Campos de crédito para Venta::create(). Con condición contado devuelve los valores neutros.
     *
     * @throws DomainException si falta el cliente o la venta pasa su límite de crédito
     */
    public function datosVenta(
        int $empresaId,
        ?int $clienteId,
        float $total,
        string $fechaVenta,
        ?string $condicion,
        ?int $dias = null,
    ): array {
        if ($condicion !== 'credito') {
            return ['condicion' => 'contado', 'dias_credito' => null, 'fecha_vencimiento' => null, 'saldo_pendiente' => 0];
        }

        if (! $clienteId) {
            throw new DomainException('Para vender al crédito selecciona un cliente.');
        }

        // Bloquea al cliente para que dos ventas simultáneas no se salten el límite
        $cliente = Cliente::where('empresa_id', $empresaId)->lockForUpdate()->find($clienteId);
        if (! $cliente) {
            throw new DomainException('El cliente no pertenece a esta empresa.');
        }
        if (! $cliente->activo) {
            throw new DomainException("El cliente {$cliente->nombre} está inactivo.");
        }

        if ($cliente->limite_credito !== null) {
            $limite     = (float) $cliente->limite_credito;
            $saldo      = $cliente->saldoPendiente();
            $disponible = round($limite - $saldo, 2);
            if (round($saldo + $total, 2) > $limite + 0.004) {
                throw new DomainException(sprintf(
                    'La venta pasa el límite de crédito de %s. Límite: L %s · Debe: L %s · Disponible: L %s · Esta venta: L %s',
                    $cliente->nombre,
                    number_format($limite, 2),
                    number_format($saldo, 2),
                    number_format(max($disponible, 0), 2),
                    number_format($total, 2),
                ));
            }
        }

        $dias = $dias ?? self::diasPara($cliente, Empresa::find($empresaId));

        return [
            'condicion'         => 'credito',
            'dias_credito'      => $dias,
            'fecha_vencimiento' => Carbon::parse($fechaVenta)->addDays($dias)->toDateString(),
            'saldo_pendiente'   => round($total, 4),
        ];
    }

    /** @throws DomainException */
    public function registrarAbono(Venta $venta, array $datos, int $usuarioId): AbonoVenta
    {
        $venta = Venta::lockForUpdate()->findOrFail($venta->id);

        if (! $venta->esCredito()) {
            throw new DomainException('Solo se pueden registrar abonos a ventas al crédito.');
        }
        if ($venta->estado === 'cancelada') {
            throw new DomainException('La venta está cancelada.');
        }

        $saldo = round((float) $venta->saldo_pendiente, 2);
        $monto = round((float) $datos['monto'], 2);

        if ($saldo <= 0) {
            throw new DomainException("La factura {$venta->numero_factura} ya está pagada.");
        }
        if ($monto > $saldo) {
            throw new DomainException(sprintf('El abono (L %s) es mayor que el saldo de la factura (L %s).',
                number_format($monto, 2), number_format($saldo, 2)));
        }

        $abono = AbonoVenta::create([
            'empresa_id'    => $venta->empresa_id,
            'venta_id'      => $venta->id,
            'cliente_id'    => $venta->cliente_id,
            'usuario_id'    => $usuarioId,
            'fecha'         => $datos['fecha'] ?? today()->toDateString(),
            'monto'         => $monto,
            'metodo_pago'   => $datos['metodo_pago'] ?? 'efectivo',
            'referencia'    => $datos['referencia'] ?? null,
            'observaciones' => $datos['observaciones'] ?? null,
        ]);

        $venta->update(['saldo_pendiente' => max(0, round((float) $venta->saldo_pendiente - $monto, 4))]);
        app(BancoService::class)->registrarAbono($abono, $datos['cuenta_bancaria_id'] ?? null, $usuarioId);

        return $abono;
    }

    /** @throws DomainException */
    public function anularAbono(AbonoVenta $abono, int $usuarioId): AbonoVenta
    {
        $abono = AbonoVenta::lockForUpdate()->findOrFail($abono->id);
        if ($abono->anulado) {
            throw new DomainException('El abono ya está anulado.');
        }

        $venta = Venta::lockForUpdate()->findOrFail($abono->venta_id);
        if ($venta->estado === 'cancelada') {
            throw new DomainException('La venta está cancelada.');
        }

        $abono->update(['anulado' => true, 'anulado_por' => $usuarioId, 'anulado_at' => now()]);
        app(BancoService::class)->anularPor('abono_venta_id', $abono->id);
        $tope = (float) $venta->total - (float) $venta->devuelto_a_saldo;
        $venta->update(['saldo_pendiente' => min($tope, round((float) $venta->saldo_pendiente + (float) $abono->monto, 4))]);

        return $abono;
    }

    /** Al cancelar una venta al crédito su saldo deja de contar. No se permite si tiene abonos vigentes. */
    public function alCancelarVenta(Venta $venta): void
    {
        if ($venta->devoluciones()->exists()) {
            throw new DomainException('La venta tiene devoluciones registradas; no se puede cancelar completa.');
        }
        if (! $venta->esCredito()) return;

        if ($venta->abonos()->where('anulado', false)->exists()) {
            throw new DomainException('La venta tiene abonos registrados. Anula los abonos antes de cancelarla.');
        }
        $venta->saldo_pendiente = 0;
    }
}
