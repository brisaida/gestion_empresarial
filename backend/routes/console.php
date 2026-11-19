<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Devuelve al inventario el stock de ventas que se cancelaron antes de que
 * cancelar devolviera el stock automáticamente. Solo las ventas indicadas.
 *   php artisan ventas:devolver-stock 74            (muestra lo que haría)
 *   php artisan ventas:devolver-stock 74 --confirmar
 */
Artisan::command('ventas:devolver-stock {ventas* : IDs de venta} {--confirmar : Aplicar los cambios}', function () {
    $usuarioId = \App\Models\User::where('es_super_admin', true)->value('id');
    $servicio  = app(\App\Services\InventarioService::class);

    foreach ($this->argument('ventas') as $id) {
        $venta = \App\Models\Venta::find($id);
        if (! $venta) { $this->error("Venta {$id}: no existe."); continue; }
        if ($venta->estado !== 'cancelada') { $this->warn("Venta {$id} ({$venta->numero_factura}): no está cancelada, se omite."); continue; }

        $ya = \App\Models\MovimientoInventario::where('tipo_referencia', 'cancelacion_venta')->where('referencia_id', $venta->id)->exists();
        if ($ya) { $this->info("Venta {$id} ({$venta->numero_factura}): el stock ya se había devuelto."); continue; }

        $lineas = \App\Models\DetalleMovimientoInventario::with('producto:id,nombre')
            ->whereHas('movimiento', fn($q) => $q->where('tipo_referencia', 'venta')->where('referencia_id', $venta->id)->where('tipo_movimiento', 'salida'))
            ->get();
        foreach ($lineas as $l) {
            $this->line(sprintf('  %s: +%s (%s)', $venta->numero_factura, (float) $l->cantidad, $l->producto?->nombre));
        }

        if (! $this->option('confirmar')) { $this->comment('  (sin --confirmar no se cambia nada)'); continue; }

        $n = \Illuminate\Support\Facades\DB::transaction(fn() => $servicio->revertirVenta($venta, $usuarioId));
        $this->info("Venta {$id} ({$venta->numero_factura}): devueltas {$n} unidades.");
    }
})->purpose('Devuelve el stock de ventas ya canceladas');
