<?php

namespace App\Http\Controllers\Api;

use App\Models\Receta;
use App\Models\RecetaIngrediente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecetaController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Receta::with('ingredientes.producto')
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('activo')) {
            $query->where('activo', filter_var($request->activo, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('search')) {
            $query->where('nombre', 'ilike', '%' . $request->search . '%');
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 50));

        return response()->json([
            'success' => true,
            'data'    => $data->map(fn($r) => $this->resource($r)),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'empresa_id'    => ['required', 'integer', 'exists:empresas,id'],
            'nombre'        => ['required', 'string', 'max:255'],
            'descripcion'   => ['nullable', 'string', 'max:1000'],
            'precio_venta'  => ['required', 'numeric', 'min:0'],
            'activo'        => ['boolean'],
            'ingredientes'  => ['required', 'array', 'min:1'],
            'ingredientes.*.producto_id' => ['required', 'integer', 'exists:productos,id'],
            'ingredientes.*.cantidad'    => ['required', 'numeric', 'min:0.0001'],
        ]);

        $receta = DB::transaction(function () use ($validated) {
            $receta = Receta::create([
                'empresa_id'   => $validated['empresa_id'],
                'nombre'       => $validated['nombre'],
                'descripcion'  => $validated['descripcion'] ?? null,
                'precio_venta' => $validated['precio_venta'],
                'activo'       => $validated['activo'] ?? true,
            ]);

            foreach ($validated['ingredientes'] as $ing) {
                RecetaIngrediente::create([
                    'receta_id'   => $receta->id,
                    'producto_id' => $ing['producto_id'],
                    'cantidad'    => $ing['cantidad'],
                ]);
            }

            return $receta->load('ingredientes.producto');
        });

        return $this->created(['success' => true, 'data' => $this->resource($receta)]);
    }

    public function show(Receta $receta): JsonResponse
    {
        $receta->load('ingredientes.producto');
        return response()->json(['success' => true, 'data' => $this->resource($receta)]);
    }

    public function update(Request $request, Receta $receta): JsonResponse
    {
        $validated = $request->validate([
            'nombre'        => ['required', 'string', 'max:255'],
            'descripcion'   => ['nullable', 'string', 'max:1000'],
            'precio_venta'  => ['required', 'numeric', 'min:0'],
            'activo'        => ['boolean'],
            'ingredientes'  => ['required', 'array', 'min:1'],
            'ingredientes.*.producto_id' => ['required', 'integer', 'exists:productos,id'],
            'ingredientes.*.cantidad'    => ['required', 'numeric', 'min:0.0001'],
        ]);

        DB::transaction(function () use ($validated, $receta) {
            $receta->update([
                'nombre'       => $validated['nombre'],
                'descripcion'  => $validated['descripcion'] ?? null,
                'precio_venta' => $validated['precio_venta'],
                'activo'       => $validated['activo'] ?? $receta->activo,
            ]);

            $receta->ingredientes()->delete();

            foreach ($validated['ingredientes'] as $ing) {
                RecetaIngrediente::create([
                    'receta_id'   => $receta->id,
                    'producto_id' => $ing['producto_id'],
                    'cantidad'    => $ing['cantidad'],
                ]);
            }
        });

        $receta->load('ingredientes.producto');
        return response()->json(['success' => true, 'data' => $this->resource($receta)]);
    }

    public function destroy(Receta $receta): JsonResponse
    {
        $receta->delete();
        return $this->noContent('Receta eliminada.');
    }

    private function resource(Receta $r): array
    {
        return [
            'id'           => $r->id,
            'empresa_id'   => $r->empresa_id,
            'nombre'       => $r->nombre,
            'descripcion'  => $r->descripcion,
            'precio_venta' => (float) $r->precio_venta,
            'activo'       => (bool) $r->activo,
            'ingredientes' => $r->relationLoaded('ingredientes')
                ? $r->ingredientes->map(fn($i) => [
                    'id'          => $i->id,
                    'producto_id' => $i->producto_id,
                    'producto'    => $i->producto?->nombre,
                    'unidad'      => $i->producto?->unidadMedida?->nombre ?? null,
                    'cantidad'    => (float) $i->cantidad,
                    'costo_unit'  => (float) ($i->producto?->costo ?? 0),
                  ])->values()
                : [],
            'costo_total'  => $r->relationLoaded('ingredientes')
                ? (float) $r->ingredientes->sum(fn($i) => $i->cantidad * ($i->producto?->costo ?? 0))
                : null,
        ];
    }
}
