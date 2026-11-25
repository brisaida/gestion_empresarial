<?php

namespace App\Services;

use App\Models\CargoTarjeta;
use App\Models\Compra;
use App\Models\DevolucionCompra;
use App\Models\PagoCompra;
use App\Models\PagoTarjeta;
use App\Models\Requisicion;
use App\Models\TarjetaCredito;
use DomainException;

/**
 * Libro de las tarjetas de crédito de la empresa.
 *
 * Los cargos se generan solos desde requisiciones, compras y pagos a proveedores pagados
 * con tarjeta (metodo_pago = 'tarjeta'). Una compra que viene de una requisición ya cargada
 * a la tarjeta no genera un segundo cargo: se enlaza al de la requisición.
 * Llamar dentro de DB::transaction().
 */
class TarjetaService
{
    public const METODO = 'tarjeta';

    /** @throws DomainException si la tarjeta no es de la empresa o está inactiva */
    public function validar(int $empresaId, ?int $tarjetaId, bool $requerida = true): ?TarjetaCredito
    {
        if (! $tarjetaId) {
            if ($requerida) throw new DomainException('Selecciona con qué tarjeta de crédito se pagó.');
            return null;
        }
        $t = TarjetaCredito::where('empresa_id', $empresaId)->find($tarjetaId);
        if (! $t) throw new DomainException('La tarjeta no pertenece a esta empresa.');
        if (! $t->activo) throw new DomainException("La tarjeta {$t->etiqueta()} está desactivada.");
        return $t;
    }

    /* ── Requisiciones ────────────────────────────────────────────── */
    public function sincronizarRequisicion(Requisicion $r, int $usuarioId): void
    {
        $cargo = CargoTarjeta::where('origen', 'requisicion')->where('requisicion_id', $r->id)->where('anulado', false)->first();

        $aplica = $r->condicion !== 'credito' && $r->metodo_pago === self::METODO
            && $r->tarjeta_credito_id && $r->estado !== 'cancelada' && (float) $r->total > 0;

        if (! $aplica) {
            $cargo?->update(['anulado' => true]);
            return;
        }

        $r->loadMissing('proveedor');
        $datos = [
            'tarjeta_credito_id' => $r->tarjeta_credito_id,
            'fecha'              => $r->fecha_requisicion->toDateString(),
            'monto'              => round((float) $r->total, 2),
            'descripcion'        => "Requisición {$r->numero_requisicion}" . ($r->proveedor ? " · {$r->proveedor->nombre}" : ''),
        ];

        $cargo
            ? $cargo->update($datos)
            : CargoTarjeta::create($datos + [
                'empresa_id' => $r->empresa_id, 'usuario_id' => $usuarioId, 'origen' => 'requisicion', 'requisicion_id' => $r->id,
            ]);
    }

    /** Requisiciones de un proveedor cargadas a tarjeta que aún no tienen compra enlazada. */
    public function requisicionesSinCompra(int $empresaId, ?int $proveedorId)
    {
        return Requisicion::where('empresa_id', $empresaId)
            ->when($proveedorId, fn($q) => $q->where('proveedor_id', $proveedorId))
            ->where('metodo_pago', self::METODO)
            ->where('estado', '!=', 'cancelada')
            ->whereHas('cargosTarjeta', fn($q) => $q->where('anulado', false)->whereNull('compra_id'))
            ->with('tarjeta')
            ->orderByDesc('fecha_requisicion')
            ->get();
    }

    /* ── Compras ──────────────────────────────────────────────────── */
    public function sincronizarCompra(Compra $c, int $usuarioId): void
    {
        $propio = CargoTarjeta::where('origen', 'compra')->where('compra_id', $c->id)->where('anulado', false)->first();
        $deReq  = $c->requisicion_id
            ? CargoTarjeta::where('origen', 'requisicion')->where('requisicion_id', $c->requisicion_id)->where('anulado', false)->first()
            : null;

        $aplica = $c->condicion !== 'credito' && $c->metodo_pago === self::METODO
            && $c->tarjeta_credito_id && $c->estado !== 'cancelada';

        // Liberar enlaces previos con otras requisiciones
        CargoTarjeta::where('origen', 'requisicion')->where('compra_id', $c->id)
            ->when($deReq, fn($q) => $q->where('id', '!=', $deReq->id))
            ->update(['compra_id' => null]);

        if (! $aplica) {
            $propio?->update(['anulado' => true]);
            $deReq?->update(['compra_id' => null]);
            return;
        }

        // Ya se cargó en la requisición: no se vuelve a cargar
        if ($deReq) {
            $deReq->update(['compra_id' => $c->id]);
            $propio?->update(['anulado' => true]);
            return;
        }

        $c->loadMissing('proveedor');
        $datos = [
            'tarjeta_credito_id' => $c->tarjeta_credito_id,
            'fecha'              => $c->fecha_compra->toDateString(),
            'monto'              => round((float) $c->total, 2),
            'descripcion'        => 'Compra ' . ($c->numero_factura ?: "#{$c->id}") . ($c->proveedor ? " · {$c->proveedor->nombre}" : ''),
        ];

        $propio
            ? $propio->update($datos)
            : CargoTarjeta::create($datos + [
                'empresa_id' => $c->empresa_id, 'usuario_id' => $usuarioId, 'origen' => 'compra', 'compra_id' => $c->id,
            ]);
    }

    /** Tarjeta con la que se pagó una compra (la suya o la de su requisición). */
    public function tarjetaDeCompra(Compra $c): ?int
    {
        if ($c->tarjeta_credito_id) return $c->tarjeta_credito_id;
        return CargoTarjeta::where('compra_id', $c->id)->where('anulado', false)->value('tarjeta_credito_id');
    }

    /* ── Pagos a proveedores con tarjeta ──────────────────────────── */
    public function cargarPagoProveedor(PagoCompra $p, int $usuarioId): void
    {
        if ($p->metodo_pago !== self::METODO || ! $p->tarjeta_credito_id) return;
        $p->loadMissing('compra', 'proveedor');
        CargoTarjeta::create([
            'empresa_id'         => $p->empresa_id,
            'tarjeta_credito_id' => $p->tarjeta_credito_id,
            'usuario_id'         => $usuarioId,
            'fecha'              => $p->fecha->toDateString(),
            'monto'              => round((float) $p->monto, 2),
            'descripcion'        => 'Pago a proveedor' . ($p->proveedor ? " {$p->proveedor->nombre}" : '') . ' · factura ' . ($p->compra?->numero_factura ?? "#{$p->compra_id}"),
            'origen'             => 'pago_proveedor',
            'compra_id'          => $p->compra_id,
            'pago_compra_id'     => $p->id,
        ]);
    }

    public function anularPorPagoProveedor(PagoCompra $p): void
    {
        CargoTarjeta::where('pago_compra_id', $p->id)->update(['anulado' => true]);
    }

    /* ── Devoluciones a proveedor reembolsadas a la tarjeta ───────── */
    public function acreditarDevolucion(DevolucionCompra $d, Compra $c, int $usuarioId): void
    {
        $tarjetaId = $this->tarjetaDeCompra($c);
        if (! $tarjetaId) {
            throw new DomainException('Esta compra no se pagó con tarjeta de crédito; elige otra forma de reembolso.');
        }
        CargoTarjeta::create([
            'empresa_id'           => $d->empresa_id,
            'tarjeta_credito_id'   => $tarjetaId,
            'usuario_id'           => $usuarioId,
            'fecha'                => $d->fecha->toDateString(),
            'monto'                => -round((float) $d->reembolsado, 2),
            'descripcion'          => "Devolución {$d->numero} · compra " . ($c->numero_factura ?? "#{$c->id}"),
            'origen'               => 'devolucion',
            'compra_id'            => $c->id,
            'devolucion_compra_id' => $d->id,
        ]);
    }

    /* ── Pagos al banco y cargos manuales ─────────────────────────── */
    public function registrarPago(TarjetaCredito $t, array $datos, int $usuarioId): PagoTarjeta
    {
        $metodo = $datos['metodo_pago'] ?? 'transferencia';
        $pago = PagoTarjeta::create([
            'empresa_id'         => $t->empresa_id,
            'tarjeta_credito_id' => $t->id,
            'usuario_id'         => $usuarioId,
            'fecha'              => $datos['fecha'] ?? today()->toDateString(),
            'monto'              => round((float) $datos['monto'], 2),
            'metodo_pago'        => $metodo,
            'desde_caja'         => $metodo === 'efectivo' && (bool) ($datos['desde_caja'] ?? false),
            'referencia'         => $datos['referencia'] ?? null,
            'observaciones'      => $datos['observaciones'] ?? null,
        ]);
        app(BancoService::class)->registrarPagoTarjeta($pago, $datos['cuenta_bancaria_id'] ?? null, $usuarioId);
        return $pago;
    }

    public function anularPago(PagoTarjeta $p, int $usuarioId): void
    {
        if ($p->anulado) throw new DomainException('El pago ya está anulado.');
        $p->update(['anulado' => true, 'anulado_por' => $usuarioId, 'anulado_at' => now()]);
        app(BancoService::class)->anularPor('pago_tarjeta_id', $p->id);
    }

    public function cargoManual(TarjetaCredito $t, array $datos, int $usuarioId): CargoTarjeta
    {
        return CargoTarjeta::create([
            'empresa_id'         => $t->empresa_id,
            'tarjeta_credito_id' => $t->id,
            'usuario_id'         => $usuarioId,
            'fecha'              => $datos['fecha'] ?? today()->toDateString(),
            'monto'              => round((float) $datos['monto'], 2),
            'descripcion'        => $datos['descripcion'],
            'origen'             => 'manual',
        ]);
    }

    public function anularCargo(CargoTarjeta $c): void
    {
        if ($c->anulado) throw new DomainException('El cargo ya está anulado.');
        if ($c->origen !== 'manual') {
            throw new DomainException('Este cargo viene de una requisición, compra o pago; corrígelo desde ese documento.');
        }
        $c->update(['anulado' => true]);
    }
}
