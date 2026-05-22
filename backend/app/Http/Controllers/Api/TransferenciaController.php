<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Inventory\StoreTransferenciaRequest;
use App\Models\Transferencia;
use App\Models\DetalleTransferencia;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransferenciaController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    public function index(Request $request): JsonResponse
    {
        $query = Transferencia::with(['bodegaOrigen', 'bodegaDestino'])
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        $data = $query->orderByDesc('fecha_transferencia')->orderByDesc('id')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $data->map(fn($t) => [
                'id'                  => $t->id,
                'bodega_origen'       => $t->bodegaOrigen?->nombre,
                'bodega_destino'      => $t->bodegaDestino?->nombre,
                'fecha_transferencia' => $t->fecha_transferencia?->toDateString(),
                'estado'              => $t->estado,
                'observaciones'       => $t->observaciones,
            ]),
            'meta' => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(StoreTransferenciaRequest $request): JsonResponse
    {
        $validated = $request->validated();

        try {
            $transferencia = DB::transaction(function () use ($validated, $request) {
                $transferencia = Transferencia::create([
                    'empresa_id'          => $validated['empresa_id'],
                    'bodega_origen_id'    => $validated['bodega_origen_id'],
                    'bodega_destino_id'   => $validated['bodega_destino_id'],
                    'usuario_id'          => $request->user()->id,
                    'fecha_transferencia' => $validated['fecha_transferencia'],
                    'observaciones'       => $validated['observaciones'] ?? null,
                    'estado'              => 'completada',
                ]);

                foreach ($validated['detalles'] as $det) {
                    DetalleTransferencia::create([
                        'transferencia_id'  => $transferencia->id,
                        'producto_id'       => $det['producto_id'],
                        'cantidad'          => $det['cantidad'],
                        'lote'              => $det['lote'] ?? null,
                        'fecha_vencimiento' => $det['fecha_vencimiento'] ?? null,
                        'numero_serie'      => $det['numero_serie'] ?? null,
                    ]);
                }

                $transferencia->load('detalles');
                $this->inventario->procesarTransferencia($transferencia, $request->user()->id);

                return $transferencia;
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $transferencia->load(['bodegaOrigen', 'bodegaDestino', 'detalles.producto']);
        return $this->created([
            'id'             => $transferencia->id,
            'bodega_origen'  => $transferencia->bodegaOrigen?->nombre,
            'bodega_destino' => $transferencia->bodegaDestino?->nombre,
            'estado'         => $transferencia->estado,
        ], 'Transferencia registrada y stock actualizado.');
    }

    public function show(Transferencia $transferencia): JsonResponse
    {
        $transferencia->load(['bodegaOrigen', 'bodegaDestino', 'detalles.producto', 'usuario']);
        return response()->json(['success' => true, 'data' => $transferencia]);
    }
}
