<?php

namespace App\Http\Controllers\Api;

use App\Models\Empresa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EmpresaController extends ApiController
{
    /* ── Datos de la empresa ─────────────────────────────────────── */
    public function show(Request $request): JsonResponse
    {
        $empresa = Empresa::findOrFail($request->integer('empresa_id'));

        return response()->json(['success' => true, 'data' => $this->resource($empresa)]);
    }

    /* ── Actualizar datos ────────────────────────────────────────── */
    public function update(Request $request): JsonResponse
    {
        $empresa = Empresa::findOrFail($request->integer('empresa_id'));

        $validated = $request->validate([
            'nombre'       => ['required', 'string', 'max:255'],
            'nombre_legal' => ['nullable', 'string', 'max:255'],
            'rtn'          => ['nullable', 'string', 'max:20'],
            'correo'       => ['nullable', 'email', 'max:255'],
            'telefono'     => ['nullable', 'string', 'max:30'],
            'direccion'    => ['nullable', 'string', 'max:500'],
            'isv_rate'     => ['nullable', 'numeric', 'min:0', 'max:100'],
            'rubro'        => ['nullable', 'string', 'in:tienda,distribuidora,farmacia,ferreteria,restaurante'],
            'config_cotizacion'                          => ['nullable', 'array'],
            'config_cotizacion.mostrar_descripcion'      => ['boolean'],
            'config_cotizacion.mostrar_foto'             => ['boolean'],
        ]);

        $empresa->update($validated);

        return response()->json(['success' => true, 'message' => 'Empresa actualizada.', 'data' => $this->resource($empresa)]);
    }

    /* ── Subir logo ──────────────────────────────────────────────── */
    public function uploadLogo(Request $request): JsonResponse
    {
        $empresa = Empresa::findOrFail($request->integer('empresa_id'));

        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpeg,jpg,png,webp,svg', 'max:2048'],
        ]);

        // Eliminar logo anterior
        if ($empresa->logo) {
            $oldPath = public_path($empresa->logo);
            if (file_exists($oldPath)) {
                @unlink($oldPath);
            }
        }

        $file      = $request->file('logo');
        $filename  = Str::random(40) . '.' . $file->getClientOriginalExtension();
        $file->move(public_path('logos'), $filename);

        $relPath = 'logos/' . $filename;
        $empresa->update(['logo' => $relPath]);

        return response()->json([
            'success' => true,
            'message' => 'Logo actualizado.',
            'data'    => ['logo_url' => '/' . $relPath],
        ]);
    }

    /* ── Eliminar logo ───────────────────────────────────────────── */
    public function deleteLogo(Request $request): JsonResponse
    {
        $empresa = Empresa::findOrFail($request->integer('empresa_id'));

        if ($empresa->logo) {
            $fullPath = public_path($empresa->logo);
            if (file_exists($fullPath)) {
                @unlink($fullPath);
            }
            $empresa->update(['logo' => null]);
        }

        return response()->json(['success' => true, 'message' => 'Logo eliminado.']);
    }

    /* ── Logo como base64 (evita CORS en PDFs) ──────────────────── */
    public function logoBase64(Request $request): JsonResponse
    {
        $empresa = Empresa::findOrFail($request->integer('empresa_id'));

        $fullPath = $empresa->logo ? public_path($empresa->logo) : null;

        if (! $fullPath || ! file_exists($fullPath)) {
            return response()->json(['success' => true, 'data' => ['logo_base64' => null]]);
        }

        $content = file_get_contents($fullPath);
        $mime    = mime_content_type($fullPath) ?: 'image/png';
        $base64  = 'data:' . $mime . ';base64,' . base64_encode($content);

        return response()->json(['success' => true, 'data' => ['logo_base64' => $base64]]);
    }

    /* ── Helper: estructura de respuesta ────────────────────────── */
    private function resource(Empresa $e): array
    {
        $defaultConfig = ['mostrar_descripcion' => false, 'mostrar_foto' => false];

        return [
            'id'                 => $e->id,
            'nombre'             => $e->nombre,
            'nombre_legal'       => $e->nombre_legal,
            'rtn'                => $e->rtn,
            'correo'             => $e->correo,
            'telefono'           => $e->telefono,
            'direccion'          => $e->direccion,
            'isv_rate'           => (float) ($e->isv_rate ?? 15),
            'rubro'              => $e->rubro,
            'logo_url'           => $e->logo ? '/' . ltrim($e->logo, '/') : null,
            'config_cotizacion'  => array_merge($defaultConfig, $e->config_cotizacion ?? []),
        ];
    }
}
