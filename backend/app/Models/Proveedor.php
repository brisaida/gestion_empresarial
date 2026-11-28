<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Proveedor extends Model
{
    use Auditable;
    use HasFactory;

    protected $table = 'proveedores';

    protected $fillable = [
        'empresa_id', 'nombre', 'rtn', 'correo',
        'telefono', 'direccion', 'departamento', 'municipio', 'activo',
        'dias_credito',
    ];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function compras()
    {
        return $this->hasMany(Compra::class);
    }

    public function pagos()
    {
        return $this->hasMany(PagoCompra::class);
    }
}
