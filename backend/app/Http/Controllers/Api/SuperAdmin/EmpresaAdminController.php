<?php

namespace App\Http\Controllers\Api\SuperAdmin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Empresa;
use App\Models\Rol;
use App\Models\UnidadMedida;
use App\Models\User;
use App\Models\UsuarioEmpresa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class EmpresaAdminController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Empresa::withCount('usuarios');

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('nombre', 'ilike', "%{$request->search}%")
                  ->orWhere('nombre_legal', 'ilike', "%{$request->search}%");
            });
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $data->map(fn($e) => [
                'id'             => $e->id,
                'nombre'         => $e->nombre,
                'nombre_legal'   => $e->nombre_legal,
                'rtn'            => $e->rtn,
                'correo'         => $e->correo,
                'telefono'       => $e->telefono,
                'direccion'      => $e->direccion,
                'rubro'          => $e->rubro,
                'logo_url'       => $e->logo ? '/' . ltrim($e->logo, '/') : null,
                'activo'         => $e->activo,
                'usuarios_count' => $e->usuarios_count,
                'created_at'     => $e->created_at?->toDateString(),
            ]),
            'meta' => [
                'total'        => $data->total(),
                'per_page'     => $data->perPage(),
                'current_page' => $data->currentPage(),
                'last_page'    => $data->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre'       => ['required', 'string', 'max:255'],
            'nombre_legal' => ['nullable', 'string', 'max:255'],
            'rtn'          => ['nullable', 'string', 'max:20'],
            'correo'       => ['nullable', 'email', 'max:255'],
            'telefono'     => ['nullable', 'string', 'max:30'],
            'direccion'    => ['nullable', 'string', 'max:500'],
            'rubro'        => ['nullable', 'string', 'in:tienda,distribuidora,farmacia,ferreteria'],
            // Primer usuario administrador (opcional): si el correo ya existe, se le da acceso a la nueva empresa
            'admin_nombre'   => ['nullable', 'required_with:admin_correo', 'string', 'max:255'],
            'admin_correo'   => ['nullable', 'required_with:admin_nombre', 'email', 'max:255'],
            'admin_password' => ['nullable', 'string', 'min:8'],
            'admin_rol_id'   => ['nullable', 'integer', 'exists:roles,id'],
        ]);

        $admin = null;
        if (! empty($validated['admin_correo'])) {
            $admin = User::where('correo', $validated['admin_correo'])->first();
            if (! $admin && empty($validated['admin_password'])) {
                return $this->error('Escribe una contraseña de al menos 8 caracteres para el administrador.', 422);
            }
        }

        $empresa = DB::transaction(function () use ($validated, &$admin) {
            $empresa = Empresa::create(array_merge(
                collect($validated)->except(['admin_nombre', 'admin_correo', 'admin_password', 'admin_rol_id'])->all(),
                ['activo' => true],
            ));
            $this->crearUnidadesDefault($empresa->id);

            if (! empty($validated['admin_correo'])) {
                $admin ??= User::create([
                    'nombre'   => $validated['admin_nombre'],
                    'correo'   => $validated['admin_correo'],
                    'password' => Hash::make($validated['admin_password']),
                    'activo'   => true,
                ]);
                // Rol elegido, o el que tiene acceso total (modulos = null)
                $rolId = $validated['admin_rol_id'] ?? Rol::whereNull('modulos')->orderBy('id')->value('id');
                UsuarioEmpresa::create(['usuario_id' => $admin->id, 'empresa_id' => $empresa->id, 'rol_id' => $rolId, 'activo' => true]);
            }
            return $empresa;
        });

        return $this->created([
            'id'           => $empresa->id,
            'nombre'       => $empresa->nombre,
            'nombre_legal' => $empresa->nombre_legal,
            'activo'       => $empresa->activo,
            'admin'        => $admin ? ['id' => $admin->id, 'nombre' => $admin->nombre, 'correo' => $admin->correo, 'existente' => ! $admin->wasRecentlyCreated] : null,
        ], 'Empresa creada correctamente.');
    }

    public function update(Request $request, Empresa $empresa): JsonResponse
    {
        $validated = $request->validate([
            'nombre'       => ['required', 'string', 'max:255'],
            'nombre_legal' => ['nullable', 'string', 'max:255'],
            'rtn'          => ['nullable', 'string', 'max:20'],
            'correo'       => ['nullable', 'email', 'max:255'],
            'telefono'     => ['nullable', 'string', 'max:30'],
            'direccion'    => ['nullable', 'string', 'max:500'],
            'rubro'        => ['nullable', 'string', 'in:tienda,distribuidora,farmacia,ferreteria'],
        ]);

        $empresa->update($validated);

        return response()->json(['success' => true, 'message' => 'Empresa actualizada.']);
    }

    public function toggle(Empresa $empresa): JsonResponse
    {
        $empresa->update(['activo' => !$empresa->activo]);

        return response()->json([
            'success' => true,
            'message' => $empresa->activo ? 'Empresa activada.' : 'Empresa desactivada.',
        ]);
    }

    private function crearUnidadesDefault(int $empresaId): void
    {
        $unidades = [
            ['nombre' => 'Unidad',     'abreviatura' => 'UND'],
            ['nombre' => 'Caja',       'abreviatura' => 'CJA'],
            ['nombre' => 'Paquete',    'abreviatura' => 'PKT'],
            ['nombre' => 'Docena',     'abreviatura' => 'DOC'],
            ['nombre' => 'Kilogramo',  'abreviatura' => 'KG'],
            ['nombre' => 'Gramo',      'abreviatura' => 'GR'],
            ['nombre' => 'Libra',      'abreviatura' => 'LB'],
            ['nombre' => 'Litro',      'abreviatura' => 'LT'],
            ['nombre' => 'Mililitro',  'abreviatura' => 'ML'],
            ['nombre' => 'Metro',      'abreviatura' => 'MT'],
            ['nombre' => 'Centímetro', 'abreviatura' => 'CM'],
            ['nombre' => 'Par',        'abreviatura' => 'PAR'],
        ];

        $now = now();
        DB::table('unidades_medida')->insert(
            array_map(fn($u) => array_merge($u, [
                'empresa_id' => $empresaId,
                'activo'     => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]), $unidades)
        );
    }
}
