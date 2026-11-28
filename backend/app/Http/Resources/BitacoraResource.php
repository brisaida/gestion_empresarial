<?php

namespace App\Http\Resources;

use App\Services\BitacoraService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BitacoraResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $antes   = $this->valores_anteriores ?? [];
        $despues = $this->valores_nuevos ?? [];
        $campos  = array_unique([...array_keys($antes), ...array_keys($despues)]);

        return [
            'id'           => $this->id,
            'fecha'        => $this->fecha?->toIso8601String(),
            'usuario'      => $this->usuario ? ['id' => $this->usuario->id, 'nombre' => $this->usuario->nombre] : null,
            'empresa'      => $this->whenLoaded('empresa', fn() => $this->empresa ? ['id' => $this->empresa->id, 'nombre' => $this->empresa->nombre] : null),
            'modulo'       => $this->modulo,
            'accion'       => $this->accion,
            'descripcion'  => $this->descripcion,
            'entidad_tipo' => $this->entidad_tipo,
            'entidad_id'   => $this->entidad_id,
            'ip'           => $this->ip,
            'cambios'      => array_values(array_map(fn($c) => [
                'campo'    => $c,
                'etiqueta' => BitacoraService::etiquetaCampo($c),
                'antes'    => $antes[$c] ?? null,
                'despues'  => $despues[$c] ?? null,
            ], $campos)),
        ];
    }
}
