<?php

namespace App\Services;

use App\Exceptions\StockInsuficienteException;
use App\Models\Bodega;
use App\Models\Existencia;
use App\Models\MovimientoInventario;
use App\Models\DetalleMovimientoInventario;
use App\Models\Producto;
use Illuminate\Support\Facades\DB;

class InventarioService
{
    /**
     * Registra un movimiento y ajusta existencias atómicamente.
     *
     * @param array $cabecera  Campos de movimientos_inventario
     * @param array $detalles  Array de ['producto_id', 'cantidad', 'costo_unitario', 'lote', ...]
     */
    public function registrarMovimiento(array $cabecera, array $detalles): MovimientoInventario
    {
        return DB::transaction(function () use ($cabecera, $detalles) {
            $movimiento = MovimientoInventario::create($cabecera);

            foreach ($detalles as $det) {
                $cantidad = abs((float) $det['cantidad']);

                DetalleMovimientoInventario::create([
                    'movimiento_inventario_id' => $movimiento->id,
                    'producto_id'              => $det['producto_id'],
                    'cantidad'                 => $cantidad,
                    'costo_unitario'           => $det['costo_unitario'] ?? 0,
                    'costo_total'              => $cantidad * ($det['costo_unitario'] ?? 0),
                    'lote'                     => $det['lote'] ?? null,
                    'fecha_vencimiento'        => $det['fecha_vencimiento'] ?? null,
                    'numero_serie'             => $det['numero_serie'] ?? null,
                ]);

                $this->ajustarExistencia(
                    empresaId:  $cabecera['empresa_id'],
                    bodegaId:   $cabecera['bodega_id'],
                    productoId: $det['producto_id'],
                    cantidad:   $cantidad,
                    tipo:       $cabecera['tipo_movimiento'],
                    lote:       $det['lote'] ?? null,
                    vencimiento: $det['fecha_vencimiento'] ?? null,
                    serie:      $det['numero_serie'] ?? null,
                );
            }

            return $movimiento->load('detalles.producto');
        });
    }

    private function ajustarExistencia(
        int $empresaId,
        ?int $bodegaId,
        int $productoId,
        float $cantidad,
        string $tipo,
        ?string $lote,
        ?string $vencimiento,
        ?string $serie,
    ): void {
        $existencia = Existencia::firstOrCreate(
            [
                'empresa_id'  => $empresaId,
                'bodega_id'   => $bodegaId,
                'producto_id' => $productoId,
                'lote'        => $lote,
                'numero_serie' => $serie,
            ],
            [
                'fecha_vencimiento'  => $vencimiento,
                'cantidad'           => 0,
                'cantidad_reservada' => 0,
            ]
        );

        $esEntrada = in_array($tipo, ['entrada', 'ajuste_positivo']);

        if ($esEntrada) {
            $existencia->increment('cantidad', $cantidad);
        } else {
            if ($existencia->cantidad < $cantidad) {
                throw new \DomainException(
                    "Stock insuficiente para el producto ID {$productoId}. "
                    . "Disponible: {$existencia->cantidad}, requerido: {$cantidad}."
                );
            }
            $existencia->decrement('cantidad', $cantidad);
        }
    }

    /**
     * Procesa una compra recibida: crea movimiento de entrada y actualiza
     * el costo promedio ponderado de cada producto.
     */
    public function procesarCompra(\App\Models\Compra $compra, int $usuarioId): void
    {
        // Actualizar costo promedio ponderado antes de registrar el movimiento
        foreach ($compra->detalles as $det) {
            $producto = Producto::lockForUpdate()->find($det->producto_id);
            if (! $producto) continue;

            // Stock total actual en toda la empresa (antes de esta entrada)
            $stockActual = Existencia::where('empresa_id', $compra->empresa_id)
                ->where('producto_id', $det->producto_id)
                ->sum('cantidad');

            $costoActual   = (float) $producto->costo;
            $costoNuevo    = (float) $det->costo_unitario;
            $cantidadNueva = (float) $det->cantidad;

            if ($stockActual + $cantidadNueva > 0) {
                $costoPromedio = (($stockActual * $costoActual) + ($cantidadNueva * $costoNuevo))
                               / ($stockActual + $cantidadNueva);

                $producto->update(['costo' => round($costoPromedio, 4)]);
            }
        }

        $detalles = $compra->detalles->map(fn($d) => [
            'producto_id'    => $d->producto_id,
            'cantidad'       => $d->cantidad,
            'costo_unitario' => $d->costo_unitario,
            'lote'           => $d->lote,
            'fecha_vencimiento' => $d->fecha_vencimiento?->toDateString(),
        ])->toArray();

        $this->registrarMovimiento([
            'empresa_id'      => $compra->empresa_id,
            'bodega_id'       => $compra->bodega_id,
            'usuario_id'      => $usuarioId,
            'tipo_movimiento' => 'entrada',
            'tipo_referencia' => 'compra',
            'referencia_id'   => $compra->id,
            'numero_documento' => $compra->numero_factura,
            'fecha'           => $compra->fecha_compra,
            'observaciones'   => "Recepción de compra #{$compra->id}",
        ], $detalles);
    }

    /**
     * Procesa una venta: crea movimiento de salida por cada línea.
     * Para líneas de receta, descuenta cada ingrediente multiplicado por las porciones vendidas.
     */
    public function procesarVenta(\App\Models\Venta $venta, int $usuarioId): void
    {
        $detalles   = [];
        $requeridos = []; // producto_id => cantidad total acumulada

        foreach ($venta->detalles as $d) {
            if ($d->receta_id && $d->relationLoaded('receta') && $d->receta) {
                foreach ($d->receta->ingredientes as $ing) {
                    $qty = (float) $ing->cantidad * (float) $d->cantidad;
                    $detalles[] = [
                        'producto_id'    => $ing->producto_id,
                        'cantidad'       => $qty,
                        'costo_unitario' => (float) ($ing->producto?->costo ?? 0),
                    ];
                    $requeridos[$ing->producto_id] = ($requeridos[$ing->producto_id] ?? 0.0) + $qty;
                }
            } else {
                $qty = (float) $d->cantidad;
                $detalles[] = [
                    'producto_id'    => $d->producto_id,
                    'cantidad'       => $qty,
                    'costo_unitario' => (float) $d->costo_unitario,
                ];
                $requeridos[$d->producto_id] = ($requeridos[$d->producto_id] ?? 0.0) + $qty;
            }
        }

        $this->validarStockDisponible($venta->empresa_id, $venta->bodega_id, $requeridos);

        $this->registrarMovimiento([
            'empresa_id'      => $venta->empresa_id,
            'bodega_id'       => $venta->bodega_id,
            'usuario_id'      => $usuarioId,
            'tipo_movimiento' => 'salida',
            'tipo_referencia' => 'venta',
            'referencia_id'   => $venta->id,
            'numero_documento' => $venta->numero_factura,
            'fecha'           => $venta->fecha_venta,
            'observaciones'   => "Despacho de venta #{$venta->id}",
        ], $detalles);
    }

    private function validarStockDisponible(int $empresaId, int $bodegaId, array $requeridos): void
    {
        if (empty($requeridos)) return;

        $productoIds = array_keys($requeridos);

        $nombres = Producto::whereIn('id', $productoIds)->pluck('nombre', 'id');

        $existencias = Existencia::where('empresa_id', $empresaId)
            ->where('bodega_id', $bodegaId)
            ->whereIn('producto_id', $productoIds)
            ->groupBy('producto_id')
            ->selectRaw('producto_id, SUM(cantidad) as total')
            ->pluck('total', 'producto_id');

        $faltantes = [];
        $errores   = [];
        foreach ($requeridos as $productoId => $cantRequerida) {
            $disponible = (float) ($existencias[$productoId] ?? 0);
            if ($disponible < $cantRequerida) {
                $nombre      = $nombres[$productoId] ?? "Producto #$productoId";
                $faltantes[] = [
                    'producto_id' => $productoId,
                    'nombre'      => $nombre,
                    'disponible'  => $disponible,
                    'requerido'   => (float) $cantRequerida,
                ];
                $errores[] = "• {$nombre}: disponible " . number_format($disponible, 3, '.', '')
                           . ", requerido " . number_format($cantRequerida, 3, '.', '');
            }
        }

        if (empty($faltantes)) return;

        // Buscar bodegas alternativas que tengan stock suficiente para TODOS los productos
        $bodegasAlternativas = [];
        $otrasBodegas = Bodega::where('empresa_id', $empresaId)
            ->where('id', '!=', $bodegaId)
            ->where('activo', true)
            ->get(['id', 'nombre']);

        foreach ($otrasBodegas as $bodega) {
            $existAlt = Existencia::where('empresa_id', $empresaId)
                ->where('bodega_id', $bodega->id)
                ->whereIn('producto_id', $productoIds)
                ->groupBy('producto_id')
                ->selectRaw('producto_id, SUM(cantidad) as total')
                ->pluck('total', 'producto_id');

            $satisface = true;
            foreach ($requeridos as $productoId => $cantRequerida) {
                if ((float) ($existAlt[$productoId] ?? 0) < (float) $cantRequerida) {
                    $satisface = false;
                    break;
                }
            }

            if ($satisface) {
                $bodegasAlternativas[] = ['id' => $bodega->id, 'nombre' => $bodega->nombre];
            }
        }

        throw new StockInsuficienteException(
            "Stock insuficiente para completar la venta:\n" . implode("\n", $errores),
            $faltantes,
            $bodegasAlternativas,
        );
    }

    /**
     * Procesa una transferencia: salida en bodega origen, entrada en bodega destino.
     */
    public function procesarTransferencia(\App\Models\Transferencia $transferencia, int $usuarioId): void
    {
        $detalles = $transferencia->detalles->map(fn($d) => [
            'producto_id'      => $d->producto_id,
            'cantidad'         => $d->cantidad,
            'costo_unitario'   => 0,
            'lote'             => $d->lote,
            'fecha_vencimiento' => $d->fecha_vencimiento?->toDateString(),
            'numero_serie'     => $d->numero_serie,
        ])->toArray();

        $base = [
            'empresa_id'  => $transferencia->empresa_id,
            'usuario_id'  => $usuarioId,
            'fecha'       => $transferencia->fecha_transferencia,
            'tipo_referencia' => 'transferencia',
            'referencia_id'   => $transferencia->id,
        ];

        $this->registrarMovimiento(array_merge($base, [
            'bodega_id'       => $transferencia->bodega_origen_id,
            'tipo_movimiento' => 'salida',
            'observaciones'   => "Transferencia salida #{$transferencia->id}",
        ]), $detalles);

        $this->registrarMovimiento(array_merge($base, [
            'bodega_id'       => $transferencia->bodega_destino_id,
            'tipo_movimiento' => 'entrada',
            'observaciones'   => "Transferencia entrada #{$transferencia->id}",
        ]), $detalles);
    }
}
