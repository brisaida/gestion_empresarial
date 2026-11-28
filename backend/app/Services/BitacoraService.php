<?php

namespace App\Services;

use App\Models\Bitacora;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

/**
 * Bitácora de auditoría: quién hizo qué, cuándo y qué valores cambiaron.
 *
 * - Los modelos con el trait `Auditable` se registran solos al crear, editar o eliminar.
 * - Los cambios masivos (query builder) no disparan eventos: regístralos con `registrar()`.
 * - Nunca interrumpe la operación: si falla la escritura, se reporta y se sigue.
 */
class BitacoraService
{
    /** Módulo (para filtrar) y nombre legible de cada modelo auditado. */
    public const MODELOS = [
        \App\Models\Producto::class        => ['catalogos', 'Producto'],
        \App\Models\Categoria::class       => ['catalogos', 'Categoría'],
        \App\Models\Marca::class           => ['catalogos', 'Marca'],
        \App\Models\UnidadMedida::class    => ['catalogos', 'Unidad de medida'],
        \App\Models\Cliente::class         => ['catalogos', 'Cliente'],
        \App\Models\Proveedor::class       => ['catalogos', 'Proveedor'],
        \App\Models\Bodega::class          => ['catalogos', 'Bodega'],
        \App\Models\Sucursal::class        => ['configuracion', 'Sucursal'],
        \App\Models\Empresa::class         => ['configuracion', 'Empresa'],
        \App\Models\Rol::class             => ['usuarios', 'Rol'],
        \App\Models\User::class            => ['usuarios', 'Usuario'],
        \App\Models\UsuarioEmpresa::class  => ['usuarios', 'Acceso de usuario'],
        \App\Models\Venta::class           => ['ventas', 'Venta'],
        \App\Models\DevolucionVenta::class => ['ventas', 'Devolución de cliente'],
        \App\Models\SesionCaja::class      => ['ventas', 'Caja'],
        \App\Models\Mesa::class            => ['ventas', 'Mesa'],
        \App\Models\Receta::class          => ['ventas', 'Receta'],
        \App\Models\Cotizacion::class      => ['cotizaciones', 'Cotización'],
        \App\Models\Compra::class          => ['compras', 'Compra'],
        \App\Models\Requisicion::class     => ['compras', 'Requisición'],
        \App\Models\DevolucionCompra::class => ['compras', 'Devolución a proveedor'],
        \App\Models\MovimientoInventario::class => ['inventario', 'Ajuste de inventario'],
        \App\Models\Transferencia::class   => ['traslados', 'Traslado'],
        \App\Models\AbonoVenta::class      => ['finanzas', 'Abono'],
        \App\Models\PagoCompra::class      => ['finanzas', 'Pago a proveedor'],
        \App\Models\TarjetaCredito::class  => ['finanzas', 'Tarjeta de crédito'],
        \App\Models\PagoTarjeta::class     => ['finanzas', 'Pago de tarjeta'],
        \App\Models\CargoTarjeta::class    => ['finanzas', 'Cargo de tarjeta'],
        \App\Models\CuentaBancaria::class  => ['finanzas', 'Cuenta bancaria'],
        \App\Models\MovimientoBanco::class => ['finanzas', 'Movimiento bancario'],
        \App\Models\CategoriaBanco::class  => ['finanzas', 'Categoría de banco'],
    ];

    /** Campos que nunca se registran (ruido o calculados por el sistema). */
    private const IGNORAR = ['created_at', 'updated_at', 'remember_token', 'saldo_pendiente'];

    /** Nombres legibles de los campos más comunes (el resto se humaniza). */
    public const CAMPOS = [
        'precio_venta' => 'Precio de venta', 'costo' => 'Costo', 'tasa_isv' => 'Tasa ISV', 'precio_incluye_isv' => 'Precio incluye ISV',
        'codigo' => 'Código', 'codigo_barra' => 'Código de barra', 'stock_minimo' => 'Stock mínimo', 'activo' => 'Activo',
        'estado' => 'Estado', 'anulado' => 'Anulado', 'total' => 'Total', 'subtotal' => 'Subtotal', 'descuento' => 'Descuento',
        'impuesto' => 'ISV', 'metodo_pago' => 'Forma de pago', 'condicion' => 'Condición', 'dias_credito' => 'Días de crédito',
        'limite_credito' => 'Límite de crédito', 'fecha_vencimiento' => 'Vence', 'rol_id' => 'Rol', 'modulos' => 'Permisos',
        'motivo_cancelacion' => 'Motivo', 'numero_factura' => 'N° factura', 'cliente_id' => 'Cliente', 'proveedor_id' => 'Proveedor',
        'bodega_id' => 'Bodega', 'categoria_id' => 'Categoría', 'marca_id' => 'Marca', 'unidad_medida_id' => 'Unidad',
        'tarjeta_credito_id' => 'Tarjeta', 'cuenta_bancaria_id' => 'Cuenta bancaria', 'correo' => 'Correo', 'rtn' => 'RTN',
        'es_super_admin' => 'Super admin', 'password' => 'Contraseña', 'pin_firma' => 'PIN de firma', 'isv_rate' => 'ISV de la empresa',
        'monto' => 'Monto', 'fecha' => 'Fecha', 'referencia' => 'Referencia', 'observaciones' => 'Observaciones',
    ];

    private static bool $pausada = false;

    /** Bitácora de los registros creados en esta petición: su edición inmediata se fusiona con el "crear". */
    private static array $creados = [];

    /* ── API pública ──────────────────────────────────────────────── */

    public function registrar(
        ?int $empresaId,
        string $modulo,
        string $accion,
        string $descripcion = '',
        array $anterior = [],
        array $nuevo = [],
        ?Model $entidad = null,
        ?int $usuarioId = null,
    ): ?Bitacora {
        try {
            return Bitacora::create([
                'empresa_id'         => $empresaId,
                'usuario_id'         => $usuarioId ?? self::usuarioId(),
                'modulo'             => $modulo,
                'accion'             => $accion,
                'entidad_tipo'       => $entidad ? class_basename($entidad) : null,
                'entidad_id'         => $entidad?->getKey(),
                'descripcion'        => Str::limit($descripcion, 500),
                'valores_anteriores' => $anterior ?: null,
                'valores_nuevos'     => $nuevo ?: null,
                'ip'                 => Request::ip(),
                'fecha'              => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
            return null;
        }
    }

    /** Ejecuta sin registrar eventos automáticos (p. ej. importaciones, que se resumen en una sola fila). */
    public static function pausar(callable $fn): mixed
    {
        $antes = self::$pausada;
        self::$pausada = true;
        try {
            return $fn();
        } finally {
            self::$pausada = $antes;
        }
    }

    public static function etiquetaCampo(string $campo): string
    {
        return self::CAMPOS[$campo] ?? Str::ucfirst(str_replace('_', ' ', preg_replace('/_id$/', '', $campo)));
    }

    /** Nombre corto de un registro: "Producto 3655 · Cable HDMI", "Venta 000-001-01-00000044". */
    public static function describir(Model $m): string
    {
        if (method_exists($m, 'bitacoraDescripcion')) return $m->bitacoraDescripcion();
        $tipo = self::MODELOS[$m::class][1] ?? class_basename($m);
        $a    = $m->getAttributes();

        $ref = $a['numero_factura'] ?? $a['numero_cotizacion'] ?? $a['numero_requisicion'] ?? $a['numero'] ?? $a['numero_documento'] ?? null;
        if (! $ref) {
            $partes = array_filter([$a['codigo'] ?? null, $a['nombre'] ?? null, isset($a['ultimos4']) ? "•••• {$a['ultimos4']}" : null]);
            $ref = $partes ? implode(' · ', $partes) : ($a['descripcion'] ?? null);
        }
        $ref = $ref ? Str::limit((string) $ref, 80) : "#{$m->getKey()}";

        if (isset($a['monto']) && is_numeric($a['monto'])) {
            $ref .= ' · L ' . number_format(abs((float) $a['monto']), 2);
        }
        return "{$tipo} {$ref}";
    }

    /* ── Eventos de modelo (trait Auditable) ──────────────────────── */

    public function auditarModelo(Model $m, string $evento): void
    {
        if (self::$pausada || ! isset(self::MODELOS[$m::class])) return;
        if (method_exists($m, 'bitacoraDebeRegistrar') && ! $m->bitacoraDebeRegistrar($evento)) return;
        // Seeders, migraciones y comandos sin usuario no ensucian la bitácora
        if (app()->runningInConsole() && ! app()->runningUnitTests() && ! self::usuarioId()) return;

        [$modulo] = self::MODELOS[$m::class];
        $empresaId = $m->getAttribute('empresa_id') ?? ($m instanceof \App\Models\Empresa ? $m->getKey() : null);
        $clave     = $m::class . '#' . $m->getKey();

        if ($evento === 'created') {
            $fila = $this->registrar($empresaId, $modulo, 'crear', self::describir($m), [], $this->valores($m, $m->getAttributes()), $m);
            if ($fila) self::$creados[$clave] = $fila->id;
            return;
        }

        if ($evento === 'deleted') {
            $this->registrar($empresaId, $modulo, 'eliminar', self::describir($m), $this->valores($m, $m->getRawOriginal()), [], $m);
            return;
        }

        // updated
        $cambios = array_diff_key($m->getChanges(), array_flip(self::IGNORAR));
        $antes = $despues = [];
        foreach ($cambios as $campo => $valor) {
            $a = $this->normalizar($m->getRawOriginal($campo));
            $d = $this->normalizar($valor);
            if ($a === $d) continue;
            $antes[$campo] = $a;
            $despues[$campo] = $d;
        }
        if (! $despues) return;

        // Recién creado en esta misma petición (p. ej. se calculan los totales): se actualiza la fila de "crear"
        if ($m->wasRecentlyCreated && isset(self::$creados[$clave])) {
            try {
                $fila = Bitacora::find(self::$creados[$clave]);
                $fila?->update(['valores_nuevos' => $this->valores($m, $m->getAttributes()), 'descripcion' => self::describir($m)]);
            } catch (\Throwable $e) {
                report($e);
            }
            return;
        }

        $accion = $this->accionDeEdicion($antes, $despues);
        $descripcion = self::describir($m);
        if ($accion === 'editar') {
            $descripcion .= ': ' . implode(', ', array_map(fn($c) => Str::lower(self::etiquetaCampo($c)), array_keys($despues)));
        } elseif (isset($despues['motivo_cancelacion'])) {
            $descripcion .= " — {$despues['motivo_cancelacion']}";
        }

        $this->registrar($empresaId, $modulo, $accion, $descripcion,
            $this->ocultar($m, $antes), $this->ocultar($m, $despues), $m);
    }

    /* ── Helpers ──────────────────────────────────────────────────── */

    private function accionDeEdicion(array $antes, array $despues): string
    {
        if (array_key_exists('estado', $despues)) {
            return match (true) {
                in_array($despues['estado'], ['cancelada', 'cancelado'], true) => 'cancelar',
                in_array($despues['estado'], ['anulada', 'anulado'], true)     => 'anular',
                $despues['estado'] === 'rechazada'                              => 'rechazar',
                default                                                         => 'cambiar_estado',
            };
        }
        if (($despues['anulado'] ?? null) === true) return 'anular';
        if (array_key_exists('activo', $despues) && count($despues) <= 2) {
            return $despues['activo'] ? 'activar' : 'desactivar';
        }
        return 'editar';
    }

    private function valores(Model $m, array $attrs): array
    {
        $out = [];
        foreach (array_diff_key($attrs, array_flip([...self::IGNORAR, 'id', 'empresa_id'])) as $campo => $valor) {
            $v = $this->normalizar($valor);
            if ($v === null || $v === '') continue;
            $out[$campo] = $v;
        }
        return $this->ocultar($m, $out);
    }

    /** Campos ocultos del modelo (contraseñas, PIN, imágenes de firma): se registra que cambiaron, no su valor. */
    private function ocultar(Model $m, array $valores): array
    {
        foreach (array_intersect(array_keys($valores), [...$m->getHidden(), 'password', 'pin_firma']) as $campo) {
            $valores[$campo] = $valores[$campo] === null ? null : '••••';
        }
        return $valores;
    }

    private function normalizar(mixed $v): mixed
    {
        if ($v instanceof \DateTimeInterface) return $v->format('Y-m-d H:i:s');
        if (is_bool($v) || $v === null || is_int($v)) return $v;
        if (is_float($v)) return round($v, 4);
        if (is_array($v)) return $v;
        $s = (string) $v;
        if (is_numeric($s) && str_contains($s, '.')) return round((float) $s, 4);
        if (is_numeric($s) && ! str_starts_with($s, '0')) return (int) $s;
        if ($s === 't' || $s === 'f') return $s === 't';      // booleanos crudos de Postgres
        if ($s !== '' && ($s[0] === '[' || $s[0] === '{')) {
            $j = json_decode($s, true);
            if (json_last_error() === JSON_ERROR_NONE) return $j;
        }
        return Str::limit($s, 300);
    }

    private static function usuarioId(): ?int
    {
        try {
            return Auth::id() ?? request()?->user()?->id;
        } catch (\Throwable) {
            return null;
        }
    }

    /** Solo para tests: limpia el estado estático entre peticiones simuladas. */
    public static function reiniciar(): void
    {
        self::$creados = [];
        self::$pausada = false;
    }
}
