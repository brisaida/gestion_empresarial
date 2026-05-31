<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ProductoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'empresa_id'         => $this->empresa_id,
            'categoria_id'       => $this->categoria_id,
            'marca_id'           => $this->marca_id,
            'unidad_medida_id'   => $this->unidad_medida_id,
            'codigo'             => $this->codigo,
            'codigo_barra'       => $this->codigo_barra,
            'nombre'             => $this->nombre,
            'descripcion'        => $this->descripcion,
            'tamaño'             => $this->tamaño,
            'peso'               => $this->peso !== null ? (float) $this->peso : null,
            'largo'              => $this->largo !== null ? (float) $this->largo : null,
            'ancho'              => $this->ancho !== null ? (float) $this->ancho : null,
            'alto'               => $this->alto !== null ? (float) $this->alto : null,
            'costo'              => (float) $this->costo,
            'precio_venta'       => (float) $this->precio_venta,
            'stock_minimo'       => (float) $this->stock_minimo,
            'maneja_lote'        => $this->maneja_lote,
            'maneja_vencimiento' => $this->maneja_vencimiento,
            'maneja_serie'       => $this->maneja_serie,
            'activo'             => $this->activo,
            'imagen_url'         => $this->imagen ? Storage::disk('public')->url($this->imagen) : null,
            // relaciones opcionales
            'categoria'          => $this->whenLoaded('categoria', fn() => ['id' => $this->categoria->id, 'nombre' => $this->categoria->nombre]),
            'marca'              => $this->whenLoaded('marca', fn() => ['id' => $this->marca->id, 'nombre' => $this->marca->nombre]),
            'unidad_medida'      => $this->whenLoaded('unidadMedida', fn() => ['id' => $this->unidadMedida->id, 'nombre' => $this->unidadMedida->nombre, 'abreviatura' => $this->unidadMedida->abreviatura]),
            'stock_total'        => $this->whenLoaded('existencias', fn() => (float) $this->existencias->sum('cantidad')),
        ];
    }
}
