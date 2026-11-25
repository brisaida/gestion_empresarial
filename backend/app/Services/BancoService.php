<?php

namespace App\Services;

use App\Models\AbonoVenta;
use App\Models\CategoriaBanco;
use App\Models\Compra;
use App\Models\CuentaBancaria;
use App\Models\DevolucionCompra;
use App\Models\DevolucionVenta;
use App\Models\Empresa;
use App\Models\MovimientoBanco;
use App\Models\PagoCompra;
use App\Models\PagoTarjeta;
use App\Models\Venta;
use DomainException;
use Illuminate\Support\Str;

/**
 * Libro de las cuentas bancarias.
 *
 * Los documentos que se pagan o cobran por banco generan su movimiento cuando tienen cuenta:
 * la que se eligió o la cuenta por defecto que la empresa configuró. Si no hay cuenta, no se
 * registra nada en bancos (el módulo es opcional). Los documentos del sistema están en lempiras,
 * así que solo se enlazan a cuentas en HNL; las cuentas en dólares se mueven a mano o con
 * transferencias entre cuentas. Llamar dentro de DB::transaction().
 */
class BancoService
{
    public const MONEDAS = ['HNL', 'USD'];

    /** Métodos de pago que pasan por banco, según el documento. */
    private const COBROS = ['tarjeta', 'transferencia', 'cheque'];
    private const PAGOS  = ['debito', 'transferencia', 'cheque'];

    public const CATEGORIAS_INICIALES = [
        ['Planilla', 'salida'], ['Alquiler', 'salida'], ['Servicios públicos', 'salida'],
        ['Impuestos', 'salida'], ['Comisiones bancarias', 'salida'], ['Intereses ganados', 'entrada'],
        ['Préstamos', 'ambos'], ['Aporte de socios', 'entrada'], ['Otros', 'ambos'],
    ];

    /* ── Cuentas ─────────────────────────────────────────────────── */
    public function validar(int $empresaId, ?int $cuentaId, bool $soloLempiras = true): ?CuentaBancaria
    {
        if (! $cuentaId) return null;
        $c = CuentaBancaria::where('empresa_id', $empresaId)->find($cuentaId);
        if (! $c) throw new DomainException('La cuenta bancaria no pertenece a esta empresa.');
        if (! $c->activo) throw new DomainException("La cuenta {$c->etiqueta()} está desactivada.");
        if ($soloLempiras && $c->moneda !== 'HNL') {
            throw new DomainException("La cuenta {$c->etiqueta()} es en {$c->moneda}; los documentos del sistema son en lempiras.");
        }
        return $c;
    }

    /** La cuenta elegida, o la cuenta por defecto de la empresa para ese uso. */
    public function cuentaPara(int $empresaId, string $uso, ?int $cuentaId): ?CuentaBancaria
    {
        if ($cuentaId) return $this->validar($empresaId, $cuentaId);
        $defecto = Empresa::find($empresaId)?->config_bancos[$uso] ?? null;
        if (! $defecto) return null;
        $c = CuentaBancaria::where('empresa_id', $empresaId)->where('activo', true)->where('moneda', 'HNL')->find($defecto);
        return $c;
    }

    public function categoriasIniciales(int $empresaId): void
    {
        if (CategoriaBanco::where('empresa_id', $empresaId)->exists()) return;
        foreach (self::CATEGORIAS_INICIALES as [$nombre, $tipo]) {
            CategoriaBanco::create(['empresa_id' => $empresaId, 'nombre' => $nombre, 'tipo' => $tipo]);
        }
    }

    /* ── Documentos ──────────────────────────────────────────────── */
    public function registrarVenta(Venta $v, ?int $cuentaId, int $usuarioId): void
    {
        if ($v->condicion === 'credito' || ! in_array($v->metodo_pago, ['tarjeta', 'transferencia'], true)) return;

        $cuenta = $this->cuentaPara($v->empresa_id, $v->metodo_pago === 'tarjeta' ? 'cuenta_tarjeta_id' : 'cuenta_transferencia_id', $cuentaId);
        if (! $cuenta) return;

        $v->update(['cuenta_bancaria_id' => $cuenta->id]);
        $desc = "Venta {$v->numero_factura}" . ($v->metodo_pago === 'tarjeta' ? ' (tarjeta)' : ' (transferencia)');
        $this->crear($cuenta, $usuarioId, 'entrada', (float) $v->total, $v->fecha_venta->toDateString(), $desc, 'venta', ['venta_id' => $v->id]);

        if ($v->metodo_pago === 'tarjeta') {
            $this->comisionPos($cuenta, $usuarioId, (float) $v->total, $v->fecha_venta->toDateString(), "Venta {$v->numero_factura}", ['venta_id' => $v->id]);
        }
    }

    public function registrarAbono(AbonoVenta $a, ?int $cuentaId, int $usuarioId): void
    {
        if (! in_array($a->metodo_pago, self::COBROS, true)) return;

        $cuenta = $this->cuentaPara($a->empresa_id, $a->metodo_pago === 'tarjeta' ? 'cuenta_tarjeta_id' : 'cuenta_transferencia_id', $cuentaId);
        if (! $cuenta) return;

        $a->update(['cuenta_bancaria_id' => $cuenta->id]);
        $a->loadMissing('venta', 'cliente');
        $desc = 'Abono' . ($a->cliente ? " de {$a->cliente->nombre}" : '') . ' · factura ' . ($a->venta?->numero_factura ?? '');
        $this->crear($cuenta, $usuarioId, 'entrada', (float) $a->monto, $a->fecha->toDateString(), $desc, 'abono', ['abono_venta_id' => $a->id], $a->referencia);

        if ($a->metodo_pago === 'tarjeta') {
            $this->comisionPos($cuenta, $usuarioId, (float) $a->monto, $a->fecha->toDateString(), $desc, ['abono_venta_id' => $a->id]);
        }
    }

    /** Compra de contado pagada por banco. Se rehace al cambiar la forma de pago o cancelar. */
    public function sincronizarCompra(Compra $c, ?int $cuentaId, int $usuarioId): void
    {
        $this->anularPor('compra_id', $c->id, 'compra');

        if ($c->estado === 'cancelada' || $c->condicion === 'credito' || ! in_array($c->metodo_pago, self::PAGOS, true)) {
            if ($c->cuenta_bancaria_id) $c->update(['cuenta_bancaria_id' => null]);
            return;
        }

        $cuenta = $this->cuentaPara($c->empresa_id, 'cuenta_pagos_id', $cuentaId ?? $c->cuenta_bancaria_id);
        $c->update(['cuenta_bancaria_id' => $cuenta?->id]);
        if (! $cuenta) return;

        $c->loadMissing('proveedor');
        $desc = 'Compra ' . ($c->numero_factura ?: "#{$c->id}") . ($c->proveedor ? " · {$c->proveedor->nombre}" : '');
        $this->crear($cuenta, $usuarioId, 'salida', (float) $c->total, $c->fecha_compra->toDateString(), $desc, 'compra', ['compra_id' => $c->id]);
    }

    public function registrarPagoCompra(PagoCompra $p, ?int $cuentaId, int $usuarioId): void
    {
        if (! in_array($p->metodo_pago, self::PAGOS, true)) return;
        $cuenta = $this->cuentaPara($p->empresa_id, 'cuenta_pagos_id', $cuentaId);
        if (! $cuenta) return;

        $p->update(['cuenta_bancaria_id' => $cuenta->id]);
        $p->loadMissing('compra', 'proveedor');
        $desc = 'Pago a ' . ($p->proveedor?->nombre ?? 'proveedor') . ' · factura ' . ($p->compra?->numero_factura ?? "#{$p->compra_id}");
        $this->crear($cuenta, $usuarioId, 'salida', (float) $p->monto, $p->fecha->toDateString(), $desc, 'pago_proveedor', ['pago_compra_id' => $p->id], $p->referencia);
    }

    public function registrarPagoTarjeta(PagoTarjeta $p, ?int $cuentaId, int $usuarioId): void
    {
        if (! in_array($p->metodo_pago, self::PAGOS, true)) return;
        $cuenta = $this->cuentaPara($p->empresa_id, 'cuenta_pagos_id', $cuentaId);
        if (! $cuenta) return;

        $p->update(['cuenta_bancaria_id' => $cuenta->id]);
        $p->loadMissing('tarjeta');
        $this->crear($cuenta, $usuarioId, 'salida', (float) $p->monto, $p->fecha->toDateString(),
            'Pago de tarjeta ' . ($p->tarjeta?->etiqueta() ?? ''), 'pago_tarjeta', ['pago_tarjeta_id' => $p->id], $p->referencia);
    }

    public function registrarDevolucionVenta(DevolucionVenta $d, ?int $cuentaId, int $usuarioId): void
    {
        if (! in_array($d->reembolso_metodo, ['transferencia', 'tarjeta'], true) || (float) $d->reembolsado <= 0) return;
        $cuenta = $this->cuentaPara($d->empresa_id, $d->reembolso_metodo === 'tarjeta' ? 'cuenta_tarjeta_id' : 'cuenta_pagos_id', $cuentaId);
        if (! $cuenta) return;

        $d->update(['cuenta_bancaria_id' => $cuenta->id]);
        $this->crear($cuenta, $usuarioId, 'salida', (float) $d->reembolsado, $d->fecha->toDateString(),
            "Reembolso devolución {$d->numero}", 'devolucion_venta', ['devolucion_venta_id' => $d->id]);
    }

    public function registrarDevolucionCompra(DevolucionCompra $d, ?int $cuentaId, int $usuarioId): void
    {
        if ($d->reembolso_metodo !== 'transferencia' || (float) $d->reembolsado <= 0) return;
        $cuenta = $this->cuentaPara($d->empresa_id, 'cuenta_pagos_id', $cuentaId);
        if (! $cuenta) return;

        $d->update(['cuenta_bancaria_id' => $cuenta->id]);
        $this->crear($cuenta, $usuarioId, 'entrada', (float) $d->reembolsado, $d->fecha->toDateString(),
            "Reembolso del proveedor · devolución {$d->numero}", 'devolucion_compra', ['devolucion_compra_id' => $d->id]);
    }

    /** Anula los movimientos generados por un documento (cancelación o anulación). */
    public function anularPor(string $columna, int $id, ?string $origen = null): void
    {
        MovimientoBanco::where($columna, $id)->where('anulado', false)
            ->when($origen, fn($q) => $q->where('origen', $origen))
            ->update(['anulado' => true]);
    }

    /* ── Operaciones desde la pantalla de bancos ─────────────────── */
    public function manual(CuentaBancaria $c, array $d, int $usuarioId): MovimientoBanco
    {
        if (! empty($d['categoria_banco_id'])) {
            $cat = CategoriaBanco::where('empresa_id', $c->empresa_id)->find($d['categoria_banco_id']);
            if (! $cat) throw new DomainException('La categoría no pertenece a esta empresa.');
        }
        return $this->crear($c, $usuarioId, $d['tipo'], (float) $d['monto'], $d['fecha'] ?? today()->toDateString(),
            $d['descripcion'], 'manual', ['categoria_banco_id' => $d['categoria_banco_id'] ?? null], $d['referencia'] ?? null);
    }

    /** Efectivo que sale de la caja y entra al banco. */
    public function depositoCaja(CuentaBancaria $c, array $d, int $usuarioId): MovimientoBanco
    {
        if ($c->moneda !== 'HNL') throw new DomainException('Los depósitos de caja son en lempiras; elige una cuenta en HNL.');
        return $this->crear($c, $usuarioId, 'entrada', (float) $d['monto'], $d['fecha'] ?? today()->toDateString(),
            'Depósito de efectivo de caja', 'deposito_caja', ['desde_caja' => true], $d['referencia'] ?? null);
    }

    /** Transferencia entre cuentas propias; si las monedas son distintas se indica cuánto llegó. */
    public function transferir(CuentaBancaria $origen, CuentaBancaria $destino, array $d, int $usuarioId): string
    {
        if ($origen->id === $destino->id) throw new DomainException('Elige dos cuentas distintas.');
        if ($origen->empresa_id !== $destino->empresa_id) throw new DomainException('Las cuentas no son de la misma empresa.');

        $monto = (float) $d['monto'];
        $llega = $origen->moneda === $destino->moneda ? $monto : (float) ($d['monto_destino'] ?? 0);
        if ($llega <= 0) {
            throw new DomainException("Indica cuántos {$destino->moneda} llegaron a la cuenta destino.");
        }

        $grupo = (string) Str::uuid();
        $fecha = $d['fecha'] ?? today()->toDateString();
        $ref   = $d['referencia'] ?? null;
        $this->crear($origen, $usuarioId, 'salida', $monto, $fecha, "Transferencia a {$destino->etiqueta()}", 'transferencia', ['grupo' => $grupo], $ref);
        $this->crear($destino, $usuarioId, 'entrada', $llega, $fecha, "Transferencia desde {$origen->etiqueta()}", 'transferencia', ['grupo' => $grupo], $ref);
        return $grupo;
    }

    public function anularMovimiento(MovimientoBanco $m): void
    {
        if ($m->anulado) throw new DomainException('El movimiento ya está anulado.');
        if (! in_array($m->origen, ['manual', 'deposito_caja', 'transferencia'], true)) {
            throw new DomainException('Este movimiento viene de un documento (venta, compra, pago…); se anula al cancelar o anular ese documento.');
        }
        $m->grupo
            ? MovimientoBanco::where('grupo', $m->grupo)->update(['anulado' => true])
            : $m->update(['anulado' => true]);
    }

    /* ── Helpers ─────────────────────────────────────────────────── */
    private function comisionPos(CuentaBancaria $c, int $usuarioId, float $base, string $fecha, string $doc, array $enlace): void
    {
        $pct = (float) $c->comision_pos_pct;
        if ($pct <= 0) return;
        $this->crear($c, $usuarioId, 'salida', round($base * $pct / 100, 2), $fecha, "Comisión POS {$pct}% · {$doc}", 'comision_pos', $enlace);
    }

    private function crear(CuentaBancaria $c, int $usuarioId, string $tipo, float $monto, string $fecha, string $desc, string $origen, array $extra = [], ?string $referencia = null): MovimientoBanco
    {
        if ($monto <= 0) throw new DomainException('El monto debe ser mayor que cero.');
        return MovimientoBanco::create($extra + [
            'empresa_id'         => $c->empresa_id,
            'cuenta_bancaria_id' => $c->id,
            'usuario_id'         => $usuarioId,
            'fecha'              => $fecha,
            'tipo'               => $tipo,
            'monto'              => round($monto, 2),
            'descripcion'        => mb_substr($desc, 0, 255),
            'origen'             => $origen,
            'referencia'         => $referencia,
        ]);
    }
}
