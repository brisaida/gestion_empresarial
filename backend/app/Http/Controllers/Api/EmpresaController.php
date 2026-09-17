<?php

namespace App\Http\Controllers\Api;

use App\Models\Empresa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
            'tipo_facturacion'                           => ['nullable', 'string', 'in:ticket,factura_a4'],
            'color_primario'        => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'color_secundario'      => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'timeout_inactividad'   => ['nullable', 'integer', 'min:5', 'max:480'],
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

        // Eliminar logo anterior del storage persistente
        if ($empresa->logo) {
            Storage::disk('public')->delete($empresa->logo);
        }

        $file     = $request->file('logo');
        $filename = Str::random(40) . '.' . $file->getClientOriginalExtension();
        $path     = Storage::disk('public')->putFileAs('logos', $file, $filename);

        $empresa->update(['logo' => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Logo actualizado.',
            'data'    => ['logo_url' => Storage::disk('public')->url($path)],
        ]);
    }

    /* ── Eliminar logo ───────────────────────────────────────────── */
    public function deleteLogo(Request $request): JsonResponse
    {
        $empresa = Empresa::findOrFail($request->integer('empresa_id'));

        if ($empresa->logo) {
            Storage::disk('public')->delete($empresa->logo);
            $empresa->update(['logo' => null]);
        }

        return response()->json(['success' => true, 'message' => 'Logo eliminado.']);
    }

    /* ── Logo como base64 (evita CORS en PDFs) ──────────────────── */
    public function logoBase64(Request $request): JsonResponse
    {
        $empresa = Empresa::findOrFail($request->integer('empresa_id'));

        if (! $empresa->logo || ! Storage::disk('public')->exists($empresa->logo)) {
            return response()->json(['success' => true, 'data' => ['logo_base64' => null]]);
        }

        $fullPath = Storage::disk('public')->path($empresa->logo);
        $content  = file_get_contents($fullPath);
        $mime     = mime_content_type($fullPath) ?: 'image/png';
        $base64  = 'data:' . $mime . ';base64,' . base64_encode($content);

        return response()->json(['success' => true, 'data' => ['logo_base64' => $base64]]);
    }

    /* ── Helper: estructura de respuesta ────────────────────────── */
    private function resource(Empresa $e): array
    {
        $defaultConfig = ['mostrar_descripcion' => false, 'mostrar_foto' => true];

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
            'logo_url'           => $e->logo ? Storage::disk('public')->url($e->logo) : null,
            'config_cotizacion'  => array_merge($defaultConfig, $e->config_cotizacion ?? []),
            'tipo_facturacion'   => $e->tipo_facturacion ?? 'factura_a4',
            'color_primario'       => $e->color_primario      ?? '#0E78D8',
            'color_secundario'     => $e->color_secundario    ?? '#072B5A',
            'timeout_inactividad'  => (int) ($e->timeout_inactividad ?? 30),
        ];
    }
}
