<?php

namespace App\Services;

use App\Models\Compra;
use App\Models\DetalleDevolucionCompra;
use App\Models\DetalleDevolucionVenta;
use App\Models\DevolucionCompra;
use App\Models\DevolucionVenta;
use App\Models\Empresa;
use App\Models\Venta;
use DomainException;

/**
 * Devoluciones parciales o totales.
 *
 * Cliente → devuelve productos de una venta: regresan a la bodega; si la venta es al
 * crédito se descuenta primero del saldo y lo que sobre se reembolsa.
 * Proveedor → se le devuelven productos de una compra recibida: salen de la bodega;
 * si la compra es al crédito baja lo que le debes y lo que sobre te lo reembolsa.
 *
 * Los montos se calculan en proporción a la factura (descuento e ISV incluidos);
 * el envío no se devuelve. Debe llamarse dentro de DB::transaction().
 */
class DevolucionService
{
    public const METODOS_REEMBOLSO_CLIENTE   = ['efectivo', 'tarjeta', 'transferencia', 'cambio'];
    public const METODOS_REEMBOLSO_PROVEEDOR = ['efectivo', 'transferencia', 'tarjeta', 'cambio'];

    public function __construct(private readonly InventarioService $inventario) {}

    /**
     * @param array $lineas  [detalle_venta_id => cantidad]
     * @param array $datos   motivo, fecha?, reembolso_metodo?, desde_caja?
     */
    public function devolverVenta(Venta $venta, array $lineas, array $datos, int $usuarioId): DevolucionVenta
    {
        $venta = Venta::lockForUpdate()->with('detalles')->findOrFail($venta->id);

        if ($venta->estado !== 'completada') {
            throw new DomainException('Solo se pueden hacer devoluciones de ventas completadas.');
        }

        $yaDevuelto = DetalleDevolucionVenta::whereIn('detalle_venta_id', $venta->detalles->pluck('id'))
            ->selectRaw('detalle_venta_id, SUM(cantidad) as cant')->groupBy('detalle_venta_id')
            ->pluck('cant', 'detalle_venta_id');

        $items = [];
        $base  = 0.0;
        foreach ($lineas as $detalleId => $cantidad) {
            $cantidad = round((float) $cantidad, 4);
            if ($cantidad <= 0) continue;

            $det = $venta->detalles->firstWhere('id', (int) $detalleId);
            if (! $det) {
                throw new DomainException('Una de las líneas no pertenece a esta venta.');
            }
            $disponible = round((float) $det->cantidad - (float) ($yaDevuelto[$det->id] ?? 0), 4);
            if ($cantidad > $disponible + 0.00005) {
                $nombre = $det->producto?->nombre ?? $det->receta?->nombre ?? $det->descripcion ?? 'producto';
                throw new DomainException("De {$nombre} solo se pueden devolver " . rtrim(rtrim(number_format($disponible, 4, '.', ''), '0'), '.') . '.');
            }

            $sub = $cantidad * (float) $det->precio_unitario;
            $base += $sub;
            $items[] = [$det, $cantidad, $sub];
        }
        if (empty($items)) {
            throw new DomainException('Indica la cantidad a devolver de al menos un producto.');
        }

        [$subtotal, $impuesto, $total] = $this->montos($base, (float) $venta->subtotal, (float) $venta->descuento, (float) $venta->impuesto);

        // Crédito: primero baja el saldo; el resto se reembolsa
        $aplicado = 0.0;
        if ($venta->condicion === 'credito') {
            $aplicado = min($total, round((float) $venta->saldo_pendiente, 4));
        }
        $reembolso = round($total - $aplicado, 4);
        $metodo    = $this->metodoReembolso($reembolso, $datos['reembolso_metodo'] ?? null, self::METODOS_REEMBOLSO_CLIENTE);

        $devolucion = DevolucionVenta::create([
            'empresa_id'       => $venta->empresa_id,
            'venta_id'         => $venta->id,
            'cliente_id'       => $venta->cliente_id,
            'bodega_id'        => $venta->bodega_id,
            'usuario_id'       => $usuarioId,
            'numero'           => $this->siguienteNumero($venta->empresa_id, DevolucionVenta::class, 'DEV'),
            'fecha'            => $datos['fecha'] ?? today()->toDateString(),
            'motivo'           => $datos['motivo'],
            'subtotal'         => $subtotal,
            'impuesto'         => $impuesto,
            'total'            => $total,
            'aplicado_a_saldo' => $aplicado,
            'reembolsado'      => $reembolso,
            'reembolso_metodo' => $metodo,
            'desde_caja'       => $metodo === 'efectivo' && (bool) ($datos['desde_caja'] ?? true),
        ]);

        $entradas = [];
        foreach ($items as [$det, $cantidad, $sub]) {
            // Los platos (recetas) ya preparados no vuelven al inventario
            $regresa = (bool) $det->producto_id;
            DetalleDevolucionVenta::create([
                'devolucion_venta_id' => $devolucion->id,
                'detalle_venta_id'    => $det->id,
                'producto_id'         => $det->producto_id,
                'receta_id'           => $det->receta_id,
                'descripcion'         => $det->descripcion,
                'cantidad'            => $cantidad,
                'precio_unitario'     => $det->precio_unitario,
                'subtotal'            => $sub,
                'regresa_a_stock'     => $regresa,
            ]);
            if ($regresa) {
                $entradas[] = ['producto_id' => $det->producto_id, 'cantidad' => $cantidad, 'costo_unitario' => (float) $det->costo_unitario];
            }
        }

        if ($entradas && $venta->bodega_id) {
            $this->inventario->registrarMovimiento([
                'empresa_id'       => $venta->empresa_id,
                'bodega_id'        => $venta->bodega_id,
                'usuario_id'       => $usuarioId,
                'tipo_movimiento'  => 'entrada',
                'tipo_referencia'  => 'devolucion_venta',
                'referencia_id'    => $devolucion->id,
                'numero_documento' => $devolucion->numero,
                'fecha'            => $devolucion->fecha->toDateString(),
                'observaciones'    => "Devolución {$devolucion->numero} de la venta {$venta->numero_factura}: {$devolucion->motivo}",
            ], $entradas);
        }

        $venta->update([
            'monto_devuelto'   => round((float) $venta->monto_devuelto + $total, 4),
            'devuelto_a_saldo' => round((float) $venta->devuelto_a_saldo + $aplicado, 4),
            'saldo_pendiente'  => max(0, round((float) $venta->saldo_pendiente - $aplicado, 4)),
        ]);

        return $devolucion;
    }

    /**
     * @param array $lineas  [detalle_compra_id => cantidad]
     */
    public function devolverCompra(Compra $compra, array $lineas, array $datos, int $usuarioId): DevolucionCompra
    {
        $compra = Compra::lockForUpdate()->with('detalles.producto')->findOrFail($compra->id);

        if ($compra->estado !== 'recibida') {
            throw new DomainException('Solo se puede devolver mercadería de compras recibidas.');
        }

        $yaDevuelto = DetalleDevolucionCompra::whereIn('detalle_compra_id', $compra->detalles->pluck('id'))
            ->selectRaw('detalle_compra_id, SUM(cantidad) as cant')->groupBy('detalle_compra_id')
            ->pluck('cant', 'detalle_compra_id');

        $items = [];
        $base  = 0.0;
        foreach ($lineas as $detalleId => $cantidad) {
            $cantidad = round((float) $cantidad, 4);
            if ($cantidad <= 0) continue;

            $det = $compra->detalles->firstWhere('id', (int) $detalleId);
            if (! $det) {
                throw new DomainException('Una de las líneas no pertenece a esta compra.');
            }
            $disponible = round((float) $det->cantidad - (float) ($yaDevuelto[$det->id] ?? 0), 4);
            if ($cantidad > $disponible + 0.00005) {
                throw new DomainException("De {$det->producto?->nombre} solo se pueden devolver " . rtrim(rtrim(number_format($disponible, 4, '.', ''), '0'), '.') . '.');
            }

            $sub = $cantidad * (float) $det->costo_unitario;
            $base += $sub;
            $items[] = [$det, $cantidad, $sub];
        }
        if (empty($items)) {
            throw new DomainException('Indica la cantidad a devolver de al menos un producto.');
        }

        [$subtotal, $impuesto, $total] = $this->montos($base, (float) $compra->subtotal, (float) $compra->descuento, (float) $compra->impuesto);

        $aplicado = 0.0;
        if ($compra->condicion === 'credito') {
            $aplicado = min($total, round((float) $compra->saldo_pendiente, 4));
        }
        $reembolso = round($total - $aplicado, 4);
        $metodo    = $this->metodoReembolso($reembolso, $datos['reembolso_metodo'] ?? null, self::METODOS_REEMBOLSO_PROVEEDOR);

        $devolucion = DevolucionCompra::create([
            'empresa_id'       => $compra->empresa_id,
            'compra_id'        => $compra->id,
            'proveedor_id'     => $compra->proveedor_id,
            'bodega_id'        => $compra->bodega_id,
            'usuario_id'       => $usuarioId,
            'numero'           => $this->siguienteNumero($compra->empresa_id, DevolucionCompra::class, 'DPV'),
            'fecha'            => $datos['fecha'] ?? today()->toDateString(),
            'motivo'           => $datos['motivo'],
            'subtotal'         => $subtotal,
            'impuesto'         => $impuesto,
            'total'            => $total,
            'aplicado_a_saldo' => $aplicado,
            'reembolsado'      => $reembolso,
            'reembolso_metodo' => $metodo,
            'desde_caja'       => $metodo === 'efectivo' && (bool) ($datos['desde_caja'] ?? true),
        ]);

        if ($metodo === TarjetaService::METODO) {
            app(TarjetaService::class)->acreditarDevolucion($devolucion, $compra, $usuarioId);
        }

        $salidas = [];
        foreach ($items as [$det, $cantidad, $sub]) {
            DetalleDevolucionCompra::create([
                'devolucion_compra_id' => $devolucion->id,
                'detalle_compra_id'    => $det->id,
                'producto_id'          => $det->producto_id,
                'cantidad'             => $cantidad,
                'costo_unitario'       => $det->costo_unitario,
                'subtotal'             => $sub,
            ]);
            $salidas[] = ['producto_id' => $det->producto_id, 'cantidad' => $cantidad, 'costo_unitario' => (float) $det->costo_unitario, 'lote' => $det->lote];
        }

        try {
            $this->inventario->registrarMovimiento([
                'empresa_id'       => $compra->empresa_id,
                'bodega_id'        => $compra->bodega_id,
                'usuario_id'       => $usuarioId,
                'tipo_movimiento'  => 'salida',
                'tipo_referencia'  => 'devolucion_compra',
                'referencia_id'    => $devolucion->id,
                'numero_documento' => $devolucion->numero,
                'fecha'            => $devolucion->fecha->toDateString(),
                'observaciones'    => "Devolución {$devolucion->numero} al proveedor (compra {$compra->numero_factura}): {$devolucion->motivo}",
            ], $salidas);
        } catch (DomainException) {
            throw new DomainException('No hay suficiente stock en la bodega para devolver esa cantidad al proveedor.');
        }

        $compra->update([
            'monto_devuelto'   => round((float) $compra->monto_devuelto + $total, 4),
            'devuelto_a_saldo' => round((float) $compra->devuelto_a_saldo + $aplicado, 4),
            'saldo_pendiente'  => max(0, round((float) $compra->saldo_pendiente - $aplicado, 4)),
        ]);

        return $devolucion;
    }

    /** Subtotal (con descuento), ISV y total de la parte devuelta, en proporción a la factura. */
    private function montos(float $base, float $subtotalDoc, float $descuentoDoc, float $impuestoDoc): array
    {
        if ($subtotalDoc <= 0) return [0.0, 0.0, 0.0];
        $proporcion = $base / $subtotalDoc;
        $subtotal   = round($base - $descuentoDoc * $proporcion, 4);
        $impuesto   = round($impuestoDoc * $proporcion, 4);
        return [$subtotal, $impuesto, round($subtotal + $impuesto, 4)];
    }

    private function metodoReembolso(float $reembolso, ?string $metodo, array $permitidos): ?string
    {
        if ($reembolso <= 0.004) return null;
        if (! $metodo || ! in_array($metodo, $permitidos, true)) {
            throw new DomainException('Indica cómo se hace el reembolso de ' . 'L ' . number_format($reembolso, 2) . '.');
        }
        return $metodo;
    }

    /** DEV-000001 / DPV-000001 correlativo por empresa. */
    private function siguienteNumero(int $empresaId, string $modelo, string $prefijo): string
    {
        Empresa::whereKey($empresaId)->lockForUpdate()->first();
        $n = $modelo::where('empresa_id', $empresaId)->count() + 1;
        return $prefijo . '-' . str_pad((string) $n, 6, '0', STR_PAD_LEFT);
    }
}
