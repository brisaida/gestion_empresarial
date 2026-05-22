<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Warehouse\StoreBodegaRequest;
use App\Http\Requests\Warehouse\UpdateBodegaRequest;
use App\Http\Resources\BodegaResource;
use App\Models\Bodega;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BodegaController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Bodega::where('empresa_id', $request->integer('empresa_id'))
            ->with('sucursal');

        if ($request->boolean('solo_activos', false)) {
            $query->where('activo', true);
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => BodegaResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(StoreBodegaRequest $request): JsonResponse
    {
        $bodega = Bodega::create($request->validated());
        $bodega->load('sucursal');
        return $this->created(new BodegaResource($bodega));
    }

    public function show(Bodega $bodega): JsonResponse
    {
        $bodega->load('sucursal');
        return response()->json(['success' => true, 'data' => new BodegaResource($bodega)]);
    }

    public function update(UpdateBodegaRequest $request, Bodega $bodega): JsonResponse
    {
        $bodega->update($request->validated());
        $bodega->load('sucursal');
        return response()->json(['success' => true, 'message' => 'Bodega actualizada.', 'data' => new BodegaResource($bodega)]);
    }

    public function destroy(Bodega $bodega): JsonResponse
    {
        if ($bodega->existencias()->where('cantidad', '>', 0)->exists()) {
            return $this->error('No se puede eliminar: la bodega tiene existencias.', 409);
        }
        $bodega->delete();
        return $this->noContent('Bodega eliminada.');
    }
}
