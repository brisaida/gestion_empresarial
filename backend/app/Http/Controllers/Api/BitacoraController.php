<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\BitacoraResource;
use App\Models\Bitacora;
use App\Models\User;
use App\Models\UsuarioEmpresa;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Consulta de la bitácora.
 * - Empresa (permiso configuracion): lo de su empresa + los inicios de sesión de sus usuarios.
 * - Super admin: todo, incluidos roles y usuarios (eventos globales sin empresa).
 */
class BitacoraController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');
        $query = Bitacora::query()->where(fn(Builder $q) => $q
            ->where('empresa_id', $empresaId)
            ->orWhere(fn(Builder $s) => $s->whereNull('empresa_id')->where('modulo', 'sesion')
                ->whereIn('usuario_id', UsuarioEmpresa::where('empresa_id', $empresaId)->select('usuario_id'))));

        return $this->listar($this->filtrar($query, $request), $request);
    }

    public function opciones(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');
        $usuarios = User::whereIn('id', UsuarioEmpresa::where('empresa_id', $empresaId)->select('usuario_id'))
            ->orderBy('nombre')->get(['id', 'nombre']);
        return $this->success(['usuarios' => $usuarios]);
    }

    public function indexGlobal(Request $request): JsonResponse
    {
        $query = Bitacora::with('empresa:id,nombre')
            ->when($request->query('empresa_id') === 'global', fn($q) => $q->whereNull('empresa_id'))
            ->when(is_numeric($request->query('empresa_id')), fn($q) => $q->where('empresa_id', $request->integer('empresa_id')));

        return $this->listar($this->filtrar($query, $request), $request);
    }

    public function opcionesGlobal(): JsonResponse
    {
        return $this->success(['usuarios' => User::orderBy('nombre')->get(['id', 'nombre'])]);
    }

    /* ── Helpers ──────────────────────────────────────────────────── */
    private function filtrar(Builder $q, Request $r): Builder
    {
        return $q
            ->when($r->filled('usuario_id'), fn($q) => $q->where('usuario_id', $r->integer('usuario_id')))
            ->when($r->filled('modulo'), fn($q) => $q->where('modulo', $r->modulo))
            ->when($r->filled('accion'), fn($q) => $q->where('accion', $r->accion))
            ->when($r->filled('entidad_tipo'), fn($q) => $q->where('entidad_tipo', $r->entidad_tipo)
                ->when($r->filled('entidad_id'), fn($q) => $q->where('entidad_id', $r->integer('entidad_id'))))
            ->when($r->filled('fecha_desde'), fn($q) => $q->whereDate('fecha', '>=', $r->fecha_desde))
            ->when($r->filled('fecha_hasta'), fn($q) => $q->whereDate('fecha', '<=', $r->fecha_hasta))
            ->when($r->filled('search'), fn($q) => $q->whereRaw('lower(descripcion) like ?', ['%' . mb_strtolower($r->search) . '%']));
    }

    private function listar(Builder $q, Request $r): JsonResponse
    {
        $data = $q->with('usuario:id,nombre')->orderByDesc('fecha')->orderByDesc('id')
            ->paginate(min($r->integer('per_page', 50), 200));

        return response()->json([
            'success' => true,
            'data'    => BitacoraResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage(), 'per_page' => $data->perPage()],
        ]);
    }
}
