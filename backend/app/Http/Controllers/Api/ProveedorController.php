<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Supplier\StoreProveedorRequest;
use App\Http\Requests\Supplier\UpdateProveedorRequest;
use App\Http\Resources\ProveedorResource;
use App\Models\Proveedor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProveedorController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Proveedor::where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('nombre', 'ilike', "%{$request->search}%")
                  ->orWhere('rtn', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->boolean('solo_activos', false)) {
            $query->where('activo', true);
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => ProveedorResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(StoreProveedorRequest $request): JsonResponse
    {
        $proveedor = Proveedor::create($request->validated());
        return $this->created(new ProveedorResource($proveedor));
    }

    public function show(Proveedor $proveedor): JsonResponse
    {
        return response()->json(['success' => true, 'data' => new ProveedorResource($proveedor)]);
    }

    public function update(UpdateProveedorRequest $request, Proveedor $proveedor): JsonResponse
    {
        $proveedor->update($request->validated());
        return response()->json(['success' => true, 'message' => 'Proveedor actualizado.', 'data' => new ProveedorResource($proveedor)]);
    }

    public function destroy(Proveedor $proveedor): JsonResponse
    {
        if ($proveedor->compras()->exists()) {
            return $this->error('No se puede eliminar: el proveedor tiene compras registradas.', 409);
        }
        $proveedor->delete();
        return $this->noContent('Proveedor eliminado.');
    }
}
