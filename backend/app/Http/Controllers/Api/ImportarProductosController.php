<?php

namespace App\Http\Controllers\Api;

use App\Models\Bodega;
use App\Models\Categoria;
use App\Models\Empresa;
use App\Models\Existencia;
use App\Models\Marca;
use App\Models\Producto;
use App\Models\UnidadMedida;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportarProductosController extends ApiController
{
    public function plantilla(Request $request): StreamedResponse
    {
        $esRestaurante = false;
        if ($request->filled('empresa_id')) {
            $empresa = Empresa::find($request->integer('empresa_id'));
            $esRestaurante = $empresa?->rubro === 'restaurante';
        }

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Productos');

        $headers = [
            'A1' => 'nombre *',
            'B1' => 'codigo',
            'C1' => 'codigo_barra',
            'D1' => 'descripcion',
            'E1' => 'categoria',
            'F1' => 'marca',
            'G1' => 'unidad (UND/KG/LT...)',
            'H1' => 'costo',
            'I1' => 'precio_venta *',
            'J1' => 'tasa_isv (%, ej: 15)',
            'K1' => 'stock_minimo',
        ];

        if ($esRestaurante) {
            $headers['L1'] = 'tipo (venta/ingrediente)';
            $headers['M1'] = 'stock_inicial';
        } else {
            $headers['L1'] = 'stock_inicial';
        }

        foreach ($headers as $cell => $value) {
            $sheet->setCellValue($cell, $value);
        }

        if ($esRestaurante) {
            $sheet->fromArray([
                'Cerveza Heineken 6-Pack', 'HEIN6PK', '7501054800083', 'Six pack botellas de vidrio 355ml',
                'Bebidas', 'Heineken', 'CJA', 198.00, 240.00, 15, 5, 'venta', 24,
            ], null, 'A2');
            $sheet->fromArray([
                'Harina de trigo', null, null, 'Bolsa 1 kg',
                'Ingredientes', null, 'KG', 32.00, 0, 0, 0, 'ingrediente', 10,
            ], null, 'A3');
            $lastCol = 'M';
        } else {
            $sheet->fromArray([
                'Cerveza Heineken 6-Pack', 'HEIN6PK', '7501054800083', 'Six pack botellas de vidrio 355ml',
                'Bebidas', 'Heineken', 'CJA', 198.00, 240.00, 15, 5, 24,
            ], null, 'A2');
            $lastCol = 'L';
        }

        $sheet->getStyle("A1:{$lastCol}1")->applyFromArray([
            'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill'      => ['fillType' => 'solid', 'startColor' => ['rgb' => '072B5A']],
            'alignment' => ['horizontal' => 'center'],
        ]);

        foreach (range('A', $lastCol) as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, 'plantilla_productos.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    public function importar(Request $request): JsonResponse
    {
        $request->validate([
            'empresa_id' => 'required|integer|exists:empresas,id',
            'archivo'    => 'required|file|mimes:xlsx,xls,csv|max:5120',
        ]);

        $empresaId = $request->integer('empresa_id');
        $path      = $request->file('archivo')->getRealPath();

        try {
            $spreadsheet = IOFactory::load($path);
        } catch (\Exception) {
            return $this->error('No se pudo leer el archivo. Asegúrate de usar la plantilla proporcionada.', 422);
        }

        $rows = $spreadsheet->getActiveSheet()->toArray(null, true, false, false);

        if (empty($rows)) {
            return $this->error('El archivo está vacío.', 422);
        }

        $mapaCampos = [
            'nombre'       => ['nombre'],
            'codigo'       => ['codigo', 'código'],
            'codigo_barra' => ['codigo_barra', 'código_barra', 'codigobarra', 'barcode', 'ean'],
            'descripcion'  => ['descripcion', 'descripción', 'detalle'],
            'categoria'    => ['categoria', 'categoría', 'category'],
            'marca'        => ['marca', 'brand'],
            'unidad'       => ['unidad', 'und', 'unidad (und/kg/lt...)'],
            'costo'        => ['costo', 'cost'],
            'precio_venta' => ['precio_venta', 'precio venta', 'precio', 'price'],
            'tasa_isv'     => ['tasa_isv', 'isv', 'impuesto', 'tasa isv'],
            'stock_minimo' => ['stock_minimo', 'stock minimo', 'stock mínimo', 'minimo'],
            'tipo'         => ['tipo', 'type'],
            'stock_inicial' => ['stock_inicial', 'stock inicial', 'existencia', 'cantidad'],
        ];

        $headerRow = array_map(fn($h) => strtolower(trim((string) $h)), $rows[0]);
        $cols = [];
        foreach ($mapaCampos as $campo => $claves) {
            foreach ($headerRow as $idx => $header) {
                foreach ($claves as $clave) {
                    if (str_contains($header, $clave)) {
                        $cols[$campo] = $idx;
                        break 2;
                    }
                }
            }
        }

        foreach (['nombre', 'precio_venta'] as $campo) {
            if (!isset($cols[$campo])) {
                $detectados = implode(', ', array_map(
                    fn($h) => '"' . $h . '"',
                    array_filter($rows[0], fn($v) => $v !== null && $v !== '')
                ));
                return $this->error(
                    "No se encontró la columna «{$campo}». Encabezados detectados: [{$detectados}]",
                    422
                );
            }
        }

        $esRestaurante = Empresa::find($empresaId)?->rubro === 'restaurante';

        // Pre-cargar catálogos
        $categorias = Categoria::where('empresa_id', $empresaId)->get()->keyBy(fn($c) => strtolower(trim($c->nombre)));
        $marcas     = Marca::where('empresa_id', $empresaId)->get()->keyBy(fn($m) => strtolower(trim($m->nombre)));
        $unidades   = UnidadMedida::where('empresa_id', $empresaId)->get()->keyBy(fn($u) => strtolower(trim($u->abreviatura)));

        // Nombres de productos ya existentes (para detección de duplicados)
        $nombresExistentes = Producto::where('empresa_id', $empresaId)
            ->pluck('nombre')
            ->map(fn($n) => strtolower(trim($n)))
            ->flip()
            ->all();

        // Bodega predeterminada para stock inicial
        $bodegaPredeterminada = Bodega::where('empresa_id', $empresaId)
            ->where('predeterminada', true)
            ->first();

        $get = fn($row, $campo) => isset($cols[$campo]) ? ($row[$cols[$campo]] ?? null) : null;

        $creados   = 0;
        $omitidos  = 0;
        $errores   = [];

        foreach ($rows as $index => $row) {
            $fila = $index + 1;

            if ($fila === 1 || empty(array_filter($row, fn($v) => $v !== null && $v !== ''))) continue;

            $nombre = trim((string) $get($row, 'nombre'));

            if (!$nombre) {
                $errores[] = ['fila' => $fila, 'error' => 'El nombre es requerido.'];
                continue;
            }

            // Saltar duplicados por nombre
            if (isset($nombresExistentes[strtolower($nombre)])) {
                $omitidos++;
                continue;
            }

            $precioVenta = self::parseNumero($get($row, 'precio_venta'));
            if ($precioVenta === null) {
                $errores[] = ['fila' => $fila, 'error' => "«{$nombre}»: precio de venta inválido o vacío."];
                continue;
            }

            $costo       = self::parseNumero($get($row, 'costo')) ?? 0.0;
            $tasaIsv     = $get($row, 'tasa_isv');
            $stockMinimo = $get($row, 'stock_minimo');
            $stockInicial = self::parseNumero($get($row, 'stock_inicial')) ?? 0.0;

            $rawTipo = strtolower(trim((string) $get($row, 'tipo')));
            $tipo    = ($esRestaurante && in_array($rawTipo, ['ingrediente', 'ingredient'])) ? 'ingrediente' : 'venta';

            // Resolver relaciones — crear si no existe
            $categoriaId = null;
            $catNombre   = trim((string) $get($row, 'categoria'));
            if ($catNombre) {
                $key = strtolower($catNombre);
                if (!isset($categorias[$key])) {
                    $nueva = Categoria::create(['empresa_id' => $empresaId, 'nombre' => $catNombre, 'activo' => true]);
                    $categorias[$key] = $nueva;
                }
                $categoriaId = $categorias[$key]->id;
            }

            $marcaId   = null;
            $marcaNombre = trim((string) $get($row, 'marca'));
            if ($marcaNombre) {
                $key = strtolower($marcaNombre);
                if (!isset($marcas[$key])) {
                    $nueva = Marca::create(['empresa_id' => $empresaId, 'nombre' => $marcaNombre, 'activo' => true]);
                    $marcas[$key] = $nueva;
                }
                $marcaId = $marcas[$key]->id;
            }

            $unidadId  = null;
            $unidadAbrev = trim((string) $get($row, 'unidad'));
            if ($unidadAbrev) {
                $key = strtolower($unidadAbrev);
                if (!isset($unidades[$key])) {
                    $nueva = UnidadMedida::create(['empresa_id' => $empresaId, 'nombre' => $unidadAbrev, 'abreviatura' => strtoupper($unidadAbrev), 'activo' => true]);
                    $unidades[$key] = $nueva;
                }
                $unidadId = $unidades[$key]->id;
            }

            $codigo      = $get($row, 'codigo');
            $codigoBarra = $get($row, 'codigo_barra');
            $descripcion = $get($row, 'descripcion');

            try {
                DB::transaction(function () use (
                    $empresaId, $nombre, $codigo, $codigoBarra, $descripcion,
                    $categoriaId, $marcaId, $unidadId, $costo, $precioVenta,
                    $tasaIsv, $stockMinimo, $tipo, $stockInicial,
                    $bodegaPredeterminada, &$creados, &$nombresExistentes
                ) {
                    $producto = Producto::create([
                        'empresa_id'         => $empresaId,
                        'nombre'             => $nombre,
                        'codigo'             => $codigo      ? trim((string) $codigo)      : null,
                        'codigo_barra'       => $codigoBarra ? trim((string) $codigoBarra) : null,
                        'descripcion'        => $descripcion ? trim((string) $descripcion) : null,
                        'marca_id'           => $marcaId,
                        'unidad_medida_id'   => $unidadId,
                        'costo'              => $costo,
                        'precio_venta'       => $precioVenta,
                        'tasa_isv'           => is_numeric($tasaIsv) ? (float) $tasaIsv : 15,
                        'stock_minimo'       => is_numeric($stockMinimo) ? (float) $stockMinimo : 0,
                        'tipo'               => $tipo,
                        'maneja_lote'        => false,
                        'maneja_vencimiento' => false,
                        'maneja_serie'       => false,
                        'activo'             => true,
                    ]);

                    if ($categoriaId) {
                        $producto->categorias()->sync([$categoriaId]);
                    }

                    if ($stockInicial > 0 && $bodegaPredeterminada) {
                        Existencia::create([
                            'empresa_id' => $empresaId,
                            'bodega_id'  => $bodegaPredeterminada->id,
                            'producto_id' => $producto->id,
                            'cantidad'   => $stockInicial,
                        ]);
                    }

                    $nombresExistentes[strtolower($nombre)] = true;
                    $creados++;
                });
            } catch (\Illuminate\Database\UniqueConstraintViolationException) {
                $errores[] = ['fila' => $fila, 'error' => "«{$nombre}»: el código «{$codigo}» ya existe en otro producto."];
            } catch (\Exception $e) {
                $errores[] = ['fila' => $fila, 'error' => "«{$nombre}»: " . $e->getMessage()];
            }
        }

        $sinBodega = !$bodegaPredeterminada;

        return response()->json([
            'success' => true,
            'data'    => [
                'creados'    => $creados,
                'omitidos'   => $omitidos,
                'errores'    => $errores,
                'sin_bodega' => $sinBodega,
            ],
            'message' => "{$creados} producto(s) importado(s) correctamente.",
        ]);
    }

    private static function parseNumero(mixed $value): ?float
    {
        if ($value === null || $value === '') return null;
        if (is_float($value) || is_int($value)) return (float) $value;

        $str = trim((string) $value);
        $str = preg_replace('/[^\d.,-]/', '', $str);

        if ($str === '' || $str === '-') return null;

        $hasDot   = str_contains($str, '.');
        $hasComma = str_contains($str, ',');

        if ($hasComma && $hasDot) {
            if (strrpos($str, ',') > strrpos($str, '.')) {
                $str = str_replace(['.', ','], ['', '.'], $str);
            } else {
                $str = str_replace(',', '', $str);
            }
        } elseif ($hasComma && !$hasDot) {
            $parts = explode(',', $str);
            if (strlen(end($parts)) <= 3 && count($parts) === 2) {
                $str = str_replace(',', '.', $str);
            } else {
                $str = str_replace(',', '', $str);
            }
        }

        return is_numeric($str) ? (float) $str : null;
    }
}
