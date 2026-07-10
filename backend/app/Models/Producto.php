<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Producto extends Model
{
    use HasFactory;

    protected $fillable = [
        'empresa_id', 'categoria_id', 'marca_id', 'unidad_medida_id',
        'codigo', 'codigo_barra', 'nombre', 'descripcion',
        'tamaño', 'peso', 'largo', 'ancho', 'alto',
        'costo', 'precio_venta', 'tasa_isv', 'stock_minimo',
        'maneja_lote', 'maneja_vencimiento', 'maneja_serie', 'activo', 'tipo', 'imagen',
    ];

    protected function casts(): array
    {
        return [
            'costo'              => 'decimal:4',
            'precio_venta'       => 'decimal:4',
            'tasa_isv'           => 'decimal:2',
            'stock_minimo'       => 'decimal:4',
            'peso'               => 'decimal:3',
            'largo'              => 'decimal:2',
            'ancho'              => 'decimal:2',
            'alto'               => 'decimal:2',
            'maneja_lote'        => 'boolean',
            'maneja_vencimiento' => 'boolean',
            'maneja_serie'       => 'boolean',
            'activo'             => 'boolean',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function categoria()
    {
        return $this->belongsTo(Categoria::class);
    }

    public function marca()
    {
        return $this->belongsTo(Marca::class);
    }

    public function unidadMedida()
    {
        return $this->belongsTo(UnidadMedida::class);
    }

    public function existencias()
    {
        return $this->hasMany(Existencia::class);
    }

    public function stockTotal(): float
    {
        return (float) $this->existencias()->sum('cantidad');
    }

    public function tieneStockBajo(): bool
    {
        return $this->stockTotal() <= $this->stock_minimo;
    }
}
