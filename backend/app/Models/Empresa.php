<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Empresa extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre', 'nombre_legal', 'rtn', 'correo',
        'telefono', 'direccion', 'logo', 'activo',
    ];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function sucursales()
    {
        return $this->hasMany(Sucursal::class);
    }

    public function bodegas()
    {
        return $this->hasMany(Bodega::class);
    }

    public function usuarios()
    {
        return $this->belongsToMany(User::class, 'usuarios_empresas', 'empresa_id', 'usuario_id')
                    ->withPivot('rol_id', 'activo')
                    ->withTimestamps();
    }

    public function categorias()
    {
        return $this->hasMany(Categoria::class);
    }

    public function marcas()
    {
        return $this->hasMany(Marca::class);
    }

    public function unidadesMedida()
    {
        return $this->hasMany(UnidadMedida::class);
    }

    public function productos()
    {
        return $this->hasMany(Producto::class);
    }

    public function proveedores()
    {
        return $this->hasMany(Proveedor::class);
    }

    public function clientes()
    {
        return $this->hasMany(Cliente::class);
    }

    public function existencias()
    {
        return $this->hasMany(Existencia::class);
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoInventario::class);
    }

    public function compras()
    {
        return $this->hasMany(Compra::class);
    }

    public function ventas()
    {
        return $this->hasMany(Venta::class);
    }

    public function transferencias()
    {
        return $this->hasMany(Transferencia::class);
    }

    public function bitacora()
    {
        return $this->hasMany(Bitacora::class);
    }
}
