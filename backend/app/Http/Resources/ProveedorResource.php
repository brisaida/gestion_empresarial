<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProveedorResource extends JsonResource
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
            'dias_credito' => $this->dias_credito,
            'saldo_pendiente' => $this->when(array_key_exists('saldo_credito', $this->resource->getAttributes()), fn() => round((float) $this->saldo_credito, 2)),
        ];
    }
}
