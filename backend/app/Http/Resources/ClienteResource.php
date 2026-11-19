<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClienteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'empresa_id' => $this->empresa_id,
            'nombre'     => $this->nombre,
            'rtn'        => $this->rtn,
            'correo'     => $this->correo,
            'telefono'   => $this->telefono,
            'direccion'    => $this->direccion,
            'departamento' => $this->departamento,
            'municipio'    => $this->municipio,
            'activo'       => $this->activo,
            'limite_credito' => $this->limite_credito !== null ? (float) $this->limite_credito : null,
            'dias_credito'   => $this->dias_credito,
            // saldo_pendiente lo calcula el index con withSum (evita una consulta por cliente)
            'saldo_pendiente' => $this->when(array_key_exists('saldo_credito', $this->resource->getAttributes()), fn() => round((float) $this->saldo_credito, 2)),
        ];
    }
}
