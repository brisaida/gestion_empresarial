<?php

namespace App\Services;

use App\Models\Empresa;
use App\Models\Venta;
use Illuminate\Support\Carbon;

/**
 * Número de factura en formato SAR: 000-001-01-00000001
 * (establecimiento - punto de emisión - tipo de documento - correlativo).
 * Usa el rango autorizado del CAI configurado en la empresa.
 */
class NumeracionFacturaService
{
    private const FORMATO = '/^(\d{3}-\d{3}-\d{2}-)(\d{8})$/';

    private const PREFIJO_DEFAULT = '000-001-01-';

    private const ZONA_HORARIA = 'America/Tegucigalpa';

    /** Avisar cuando falten estos días o números o menos */
    private const AVISO_DIAS = 15;

    private const AVISO_NUMEROS = 20;

    /**
     * Número y datos fiscales para una venta nueva, listos para Venta::create().
     * Debe llamarse dentro de DB::transaction().
     *
     * @throws \DomainException si el CAI venció o se agotó el rango autorizado
     */
    public static function asignar(int $empresaId): array
    {
        $empresa = Empresa::findOrFail($empresaId);

        return [
            'numero_factura' => self::calcular($empresa, bloquear: true)['numero'],
            'cai' => $empresa->cai,
            'cai_rango_desde' => $empresa->factura_rango_desde,
            'cai_rango_hasta' => $empresa->factura_rango_hasta,
            'cai_fecha_limite' => $empresa->factura_fecha_limite,
        ];
    }

    /**
     * Vista previa para la pantalla de ventas: siguiente número y avisos, sin bloquear filas.
     *
     * @return array{numero_factura: ?string, aviso: ?string, bloqueado: bool}
     */
    public static function estado(int $empresaId): array
    {
        $empresa = Empresa::findOrFail($empresaId);

        try {
            $r = self::calcular($empresa, bloquear: false);
        } catch (\DomainException $e) {
            return ['numero_factura' => null, 'aviso' => $e->getMessage(), 'bloqueado' => true];
        }

        $avisos = [];
        if ($r['dias'] !== null && $r['dias'] <= self::AVISO_DIAS) {
            $avisos[] = $r['dias'] === 0
                ? 'Tu CAI vence hoy.'
                : "Tu CAI vence en {$r['dias']} ".($r['dias'] === 1 ? 'día' : 'días').'.';
        }
        if ($r['restantes'] !== null && $r['restantes'] <= self::AVISO_NUMEROS) {
            $avisos[] = $r['restantes'] === 1
                ? 'Queda 1 factura en el rango autorizado.'
                : "Quedan {$r['restantes']} facturas en el rango autorizado.";
        }

        return [
            'numero_factura' => $r['numero'],
            'aviso' => $avisos ? implode(' ', $avisos).' Solicita un nuevo CAI al SAR.' : null,
            'bloqueado' => false,
        ];
    }

    /**
     * @return array{numero: string, dias: ?int, restantes: ?int}
     *
     * @throws \DomainException
     */
    private static function calcular(Empresa $empresa, bool $bloquear): array
    {
        // Fecha límite de emisión (en hora de Honduras)
        $dias = null;
        if ($empresa->factura_fecha_limite) {
            $hoy = Carbon::now(self::ZONA_HORARIA)->startOfDay();
            $limite = Carbon::parse($empresa->factura_fecha_limite->toDateString(), self::ZONA_HORARIA)->startOfDay();
            if ($hoy->gt($limite)) {
                throw new \DomainException(
                    "La fecha límite de emisión de tu CAI venció el {$limite->format('d/m/Y')}. Registra el nuevo CAI y rango en Configuración."
                );
            }
            $dias = (int) $hoy->diffInDays($limite);
        }

        $prefijo = self::PREFIJO_DEFAULT;
        $inicio = 1;
        $fin = null;

        if ($empresa->factura_rango_desde && preg_match(self::FORMATO, $empresa->factura_rango_desde, $m)) {
            $prefijo = $m[1];
            $inicio = (int) $m[2];
            if ($empresa->factura_rango_hasta && preg_match(self::FORMATO, $empresa->factura_rango_hasta, $h) && $h[1] === $prefijo) {
                $fin = (int) $h[2];
            }
        }

        // El correlativo es de ancho fijo, así que el orden alfabético coincide con el numérico
        $query = Venta::where('empresa_id', $empresa->id)
            ->where('numero_factura', 'like', $prefijo.'%')
            ->orderByDesc('numero_factura');
        if ($bloquear) {
            $query->lockForUpdate();
        }
        $ultima = $query->value('numero_factura');

        $siguiente = $ultima && preg_match(self::FORMATO, $ultima, $u)
            ? max($inicio, ((int) $u[2]) + 1)
            : $inicio;

        if ($fin !== null && $siguiente > $fin) {
            throw new \DomainException(
                "Se agotó el rango autorizado de facturas (hasta {$empresa->factura_rango_hasta}). Registra el nuevo CAI y rango en Configuración."
            );
        }

        return [
            'numero' => $prefijo.str_pad((string) $siguiente, 8, '0', STR_PAD_LEFT),
            'dias' => $dias,
            'restantes' => $fin !== null ? $fin - $siguiente + 1 : null,
        ];
    }
}
