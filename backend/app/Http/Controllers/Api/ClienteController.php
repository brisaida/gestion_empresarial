<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ClienteResource;
use App\Models\Cliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClienteController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Cliente::where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('nombre', 'ilike', "%{$request->search}%")
                  ->orWhere('rtn', 'ilike', "%{$request->search}%");
            });
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => ClienteResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'empresa_id' => ['required', 'integer', 'exists:empresas,id'],
            'nombre'     => ['required', 'string', 'max:200'],
            'rtn'        => ['nullable', 'string', 'max:30'],
            'correo'     => ['nullable', 'email', 'max:100'],
            'telefono'   => ['nullable', 'string', 'max:30'],
            'direccion'    => ['nullable', 'string', 'max:255'],
            'departamento' => ['nullable', 'string', 'max:100'],
            'municipio'    => ['nullable', 'string', 'max:100'],
            'activo'       => ['boolean'],
        ]);
        $cliente = Cliente::create($data);
        return $this->created(new ClienteResource($cliente));
    }

    public function show(Cliente $cliente): JsonResponse
    {
        return response()->json(['success' => true, 'data' => new ClienteResource($cliente)]);
    }

    public function update(Request $request, Cliente $cliente): JsonResponse
    {
        $data = $request->validate([
            'nombre'    => ['sometimes', 'required', 'string', 'max:200'],
            'rtn'       => ['nullable', 'string', 'max:30'],
            'correo'    => ['nullable', 'email', 'max:100'],
            'telefono'  => ['nullable', 'string', 'max:30'],
            'direccion'    => ['nullable', 'string', 'max:255'],
            'departamento' => ['nullable', 'string', 'max:100'],
            'municipio'    => ['nullable', 'string', 'max:100'],
            'activo'       => ['boolean'],
        ]);
        $cliente->update($data);
        return response()->json(['success' => true, 'message' => 'Cliente actualizado.', 'data' => new ClienteResource($cliente)]);
    }

    public function destroy(Cliente $cliente): JsonResponse
    {
        if ($cliente->ventas()->exists()) {
            return $this->error('No se puede eliminar: el cliente tiene ventas registradas.', 409);
        }
        $cliente->delete();
        return $this->noContent('Cliente eliminado.');
    }
}
