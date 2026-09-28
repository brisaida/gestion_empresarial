<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\RequisicionResource;
use App\Models\DetalleRequisicion;
use App\Models\Requisicion;
use App\Services\AutorizacionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RequisicionController extends ApiController
{
    public function __construct(private readonly AutorizacionService $autorizacion) {}

    /* ── Siguiente número correlativo ─────────────────────────────── */
    public function siguienteNumero(Request $request): JsonResponse
    {
        return $this->success([
            'numero_requisicion' => $this->siguiente($request->integer('empresa_id')),
        ]);
    }

    /* ── Listado ──────────────────────────────────────────────────── */
    public function index(Request $request): JsonResponse
    {
        $query = Requisicion::with(['proveedor', 'autorizador:id,nombre'])->withCount('detalles')
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('estado'))       $query->where('estado', $request->estado);
        if ($request->filled('proveedor_id')) $query->where('proveedor_id', $request->integer('proveedor_id'));
        if ($request->filled('search'))       $query->where('numero_requisicion', 'like', "%{$request->search}%");
        if ($request->filled('fecha_desde'))  $query->whereDate('fecha_requisicion', '>=', $request->fecha_desde);
        if ($request->filled('fecha_hasta'))  $query->whereDate('fecha_requisicion', '<=', $request->fecha_hasta);

        $data = $query->orderByDesc('fecha_requisicion')->orderByDesc('id')
                      ->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => RequisicionResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    /* ── Crear ────────────────────────────────────────────────────── */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate(['empresa_id' => ['required', 'integer', 'exists:empresas,id']] + $this->reglas());

        $requisicion = DB::transaction(function () use ($validated, $request) {
            $requisicion = Requisicion::create([
                'empresa_id'         => $validated['empresa_id'],
                'proveedor_id'       => $validated['proveedor_id'] ?? null,
                'usuario_id'         => $request->user()->id,
                'numero_requisicion' => $this->siguiente($validated['empresa_id'], lock: true),
                'fecha_requisicion'  => $validated['fecha_requisicion'],
                'realizado_por'      => $validated['realizado_por'] ?? $request->user()->nombre,
                'observaciones'      => $validated['observaciones'] ?? null,
                'estado'             => 'borrador',
            ]);

            $this->guardarDetalles($requisicion, $validated['detalles']);

            return $requisicion;
        });

        return $this->created(new RequisicionResource($requisicion->load(['proveedor', 'detalles.producto', 'autorizador:id,nombre'])));
    }

    /* ── Ver detalle ──────────────────────────────────────────────── */
    public function show(Request $request, Requisicion $requisicion): JsonResponse
    {
        $this->verificarEmpresa($request, $requisicion);

        return $this->success(new RequisicionResource($requisicion->load(['proveedor', 'detalles.producto', 'autorizador:id,nombre'])));
    }

    /* ── Editar (solo en borrador) ────────────────────────────────── */
    public function update(Request $request, Requisicion $requisicion): JsonResponse
    {
        $this->verificarEmpresa($request, $requisicion);

        if ($requisicion->estado !== 'borrador') {
            return $this->error('Solo se pueden editar requisiciones en estado borrador.', 422);
        }
        if ($requisicion->autorizado_at) {
            return $this->error('La requisición ya fue autorizada y no se puede editar.', 422);
        }

        $validated = $request->validate($this->reglas());

        DB::transaction(function () use ($requisicion, $validated) {
            $requisicion->update([
                'proveedor_id'      => $validated['proveedor_id'] ?? null,
                'fecha_requisicion' => $validated['fecha_requisicion'],
                'realizado_por'     => $validated['realizado_por'] ?? $requisicion->realizado_por,
                'observaciones'     => $validated['observaciones'] ?? null,
            ]);

            $requisicion->detalles()->delete();
            $this->guardarDetalles($requisicion, $validated['detalles']);
        });

        return $this->success(new RequisicionResource($requisicion->load(['proveedor', 'detalles.producto', 'autorizador:id,nombre'])));
    }

    /* ── Cambiar estado ───────────────────────────────────────────── */
    public function cambiarEstado(Request $request, Requisicion $requisicion): JsonResponse
    {
        $this->verificarEmpresa($request, $requisicion);

        $request->validate(['estado' => ['required', 'string']]);
        $nuevoEstado = $request->estado;

        $transiciones = [
            'borrador' => ['enviada', 'cancelada'],
            'enviada'  => ['recibida', 'cancelada', 'borrador'],
        ];

        if (! in_array($nuevoEstado, $transiciones[$requisicion->estado] ?? [])) {
            return $this->error("No se puede cambiar de '{$requisicion->estado}' a '{$nuevoEstado}'.", 422);
        }

        $requisicion->update(['estado' => $nuevoEstado]);

        return $this->success(new RequisicionResource($requisicion->load('proveedor')));
    }

    /* ── Autorizar con PIN (firma y sello de la empresa) ────────────── */
    public function autorizar(Request $request, Requisicion $requisicion): JsonResponse
    {
        $this->verificarEmpresa($request, $requisicion);
        $request->validate(['pin' => ['required', 'string', 'max:10']]);

        if ($requisicion->estado === 'cancelada') {
            return $this->error('No se puede autorizar una requisición cancelada.', 422);
        }

        try {
            $this->autorizacion->autorizar($requisicion, $request->user(), $request->string('pin'));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success(new RequisicionResource($requisicion->load(['proveedor', 'autorizador:id,nombre'])), 'Requisición autorizada.');
    }

    /* ── Firma y sello para imprimir (solo si está autorizada) ──────── */
    public function firma(Request $request, Requisicion $requisicion): JsonResponse
    {
        $this->verificarEmpresa($request, $requisicion);

        return $this->success($this->autorizacion->datosFirma($requisicion->load('autorizador:id,nombre')));
    }

    /* ── Helpers ──────────────────────────────────────────────────── */
    private function reglas(): array
    {
        return [
            'proveedor_id'      => ['nullable', 'integer', 'exists:proveedores,id'],
            'fecha_requisicion' => ['required', 'date'],
            'realizado_por'     => ['nullable', 'string', 'max:150'],
            'observaciones'     => ['nullable', 'string', 'max:1000'],
            'detalles'          => ['required', 'array', 'min:1'],
            // Línea de catálogo (producto_id) o artículo libre (descripcion)
            'detalles.*.producto_id' => ['nullable', 'required_without:detalles.*.descripcion', 'integer', 'exists:productos,id'],
            'detalles.*.descripcion' => ['nullable', 'required_without:detalles.*.producto_id', 'string', 'max:255'],
            'detalles.*.codigo'      => ['nullable', 'string', 'max:60'],
            'detalles.*.cantidad'    => ['required', 'numeric', 'min:0.0001'],
        ];
    }

    private function guardarDetalles(Requisicion $requisicion, array $detalles): void
    {
        foreach ($detalles as $det) {
            $libre = empty($det['producto_id']);
            DetalleRequisicion::create([
                'requisicion_id' => $requisicion->id,
                'producto_id'    => $det['producto_id'] ?? null,
                'codigo'         => $libre ? (trim($det['codigo'] ?? '') ?: null) : null,
                'descripcion'    => $libre ? trim($det['descripcion']) : null,
                'cantidad'       => $det['cantidad'],
            ]);
        }
    }

    private function siguiente(int $empresaId, bool $lock = false): string
    {
        $query = Requisicion::where('empresa_id', $empresaId)
            ->where('numero_requisicion', 'like', 'REQ-%')
            ->orderByDesc('id');
        if ($lock) $query->lockForUpdate();

        $ultima    = $query->value('numero_requisicion');
        $partes    = $ultima ? explode('-', $ultima) : [];
        $siguiente = $partes ? ((int) end($partes)) + 1 : 1;

        return 'REQ-' . str_pad($siguiente, 4, '0', STR_PAD_LEFT);
    }

    /** La requisición debe pertenecer a una empresa activa del usuario. */
    private function verificarEmpresa(Request $request, Requisicion $requisicion): void
    {
        $user = $request->user();
        if ($user->es_super_admin) return;

        $pertenece = $user->empresas()
            ->where('empresa_id', $requisicion->empresa_id)
            ->where('usuarios_empresas.activo', true)
            ->exists();

        abort_unless($pertenece, 404);
    }
}
