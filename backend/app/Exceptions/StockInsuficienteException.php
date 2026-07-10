<?php

namespace App\Exceptions;

use RuntimeException;

class StockInsuficienteException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly array $faltantes,           // [{ producto_id, nombre, disponible, requerido }]
        public readonly array $bodegasAlternativas, // [{ id, nombre }]
    ) {
        parent::__construct($message);
    }
}
