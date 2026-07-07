<?php

namespace App\Http\Controllers\Api;

use App\Models\Categoria;
use App\Models\Marca;
use App\Models\Producto;
use App\Models\UnidadMedida;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportarProductosController extends ApiController
{
    /**
     * Descarga la plantilla Excel para importar productos.
     */
    public function plantilla(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Productos');

        // Encabezados
        $headers = [
            'A1' => 'nombre *',
            'B1' => 'codigo',
            'C1' => 'codigo_barra',
            'D1' => 'descripcion',
            'E1' => 'categoria',
            'F1' => 'marca',
            'G1' => 'unidad (UND/KG/LT...)',
            'H1' => 'costo *',
            'I1' => 'precio_venta *',
            'J1' => 'tasa_isv (%, ej: 15)',
            'K1' => 'stock_minimo',
        ];

        foreach ($headers as $cell => $value) {
            $sheet->setCellValue($cell, $value);
        }

        // Fila de ejemplo
        $sheet->fromArray([
            'Cerveza Heineken 6-Pack', 'HEIN6PK', '7501054800083', 'Six pack botellas de vidrio 355ml',
            'Bebidas', 'Heineken', 'CJA', 198.00, 240.00, 15, 5,
        ], null, 'A2');

        // Estilo encabezado
        $headerStyle = [
            'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill'      => ['fillType' => 'solid', 'startColor' => ['rgb' => '072B5A']],
            'alignment' => ['horizontal' => 'center'],
        ];
        $sheet->getStyle('A1:K1')->applyFromArray($headerStyle);

        // Ancho de columnas
        foreach (range('A', 'K') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, 'plantilla_productos.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * Procesa el archivo Excel e importa los productos.
     */
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
        } catch (\Exception $e) {
            return $this->error('No se pudo leer el archivo. Asegúrate de usar la plantilla proporcionada.', 422);
        }

        $rows    = $spreadsheet->getActiveSheet()->toArray(null, true, false, false);
        $creados = 0;
        $errores = [];

        if (empty($rows)) {
            return $this->error('El archivo está vacío.', 422);
        }

        // Mapa de palabras clave → nombre de campo
        $mapaCampos = [
            'nombre'       => ['nombre'],
            'codigo'       => ['codigo', 'código'],
            'codigo_barra' => ['codigo_barra', 'código_barra', 'codigobarra', 'barcode', 'ean'],
            'descripcion'  => ['descripcion', 'descripción', 'detalle'],
            'categoria'    => ['categoria', 'categoría', 'category'],
            'marca'        => ['marca', 'brand'],
            'unidad'       => ['unidad', 'und', 'unidad (und/kg/lt...)'],
            'costo'        => ['costo', 'cost', 'costo *'],
            'precio_venta' => ['precio_venta', 'precio venta', 'precio', 'price', 'precio_venta *'],
            'tasa_isv'     => ['tasa_isv', 'isv', 'impuesto', 'tasa isv (%, ej: 15)'],
            'stock_minimo' => ['stock_minimo', 'stock minimo', 'stock mínimo', 'minimo'],
        ];

        // Detectar índices de columnas desde la fila de encabezados
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

        // Validar que las columnas obligatorias existan
        $obligatorias = ['nombre', 'costo', 'precio_venta'];
        foreach ($obligatorias as $campo) {
            if (!isset($cols[$campo])) {
                $headersDetectados = implode(', ', array_map(
                    fn($h) => '"' . $h . '"',
                    array_filter($rows[0], fn($v) => $v !== null && $v !== '')
                ));
                return $this->error(
                    "No se encontró la columna «{$campo}». Encabezados detectados: [{$headersDetectados}]",
                    422
                );
            }
        }

        // Cache de catálogos para no consultar la BD por cada fila
        $categorias = Categoria::where('empresa_id', $empresaId)->get()->keyBy(fn($c) => strtolower(trim($c->nombre)));
        $marcas     = Marca::where('empresa_id', $empresaId)->get()->keyBy(fn($m) => strtolower(trim($m->nombre)));
        $unidades   = UnidadMedida::where('empresa_id', $empresaId)->get()->keyBy(fn($u) => strtolower(trim($u->abreviatura)));

        $get = fn($row, $campo) => isset($cols[$campo]) ? ($row[$cols[$campo]] ?? null) : null;

        foreach ($rows as $index => $row) {
            $fila = $index + 1;

            // Saltar encabezado y filas vacías
            if ($fila === 1 || empty(array_filter($row))) continue;

            $nombre          = trim((string) $get($row, 'nombre'));
            $codigo          = $get($row, 'codigo');
            $codigoBarra     = $get($row, 'codigo_barra');
            $descripcion     = $get($row, 'descripcion');
            $categoriaNombre = $get($row, 'categoria');
            $marcaNombre     = $get($row, 'marca');
            $unidadAbrev     = $get($row, 'unidad');
            $rawCosto        = $get($row, 'costo');
            $rawPrecioVenta  = $get($row, 'precio_venta');
            $tasaIsv         = $get($row, 'tasa_isv');
            $stockMinimo     = $get($row, 'stock_minimo');

            if (!$nombre) {
                $errores[] = ['fila' => $fila, 'error' => 'El nombre es requerido.'];
                continue;
            }

            $costo       = self::parseNumero($rawCosto) ?? 0.0;
            $precioVenta = self::parseNumero($rawPrecioVenta);

            if ($precioVenta === null) {
                $errores[] = ['fila' => $fila, 'error' => "Precio de venta inválido o vacío en «{$nombre}»."];
                continue;
            }

            // Resolver relaciones — crear si no existe
            $categoriaId = null;
            if ($categoriaNombre = trim((string) $categoriaNombre)) {
                $key = strtolower($categoriaNombre);
                if (!isset($categorias[$key])) {
                    $nueva = Categoria::create(['empresa_id' => $empresaId, 'nombre' => $categoriaNombre, 'activo' => true]);
                    $categorias[$key] = $nueva;
                }
                $categoriaId = $categorias[$key]->id;
            }

            $marcaId = null;
            if ($marcaNombre = trim((string) $marcaNombre)) {
                $key = strtolower($marcaNombre);
                if (!isset($marcas[$key])) {
                    $nueva = Marca::create(['empresa_id' => $empresaId, 'nombre' => $marcaNombre, 'activo' => true]);
                    $marcas[$key] = $nueva;
                }
                $marcaId = $marcas[$key]->id;
            }

            $unidadId = null;
            if ($unidadAbrev = trim((string) $unidadAbrev)) {
                $key = strtolower($unidadAbrev);
                if (!isset($unidades[$key])) {
                    $nueva = UnidadMedida::create(['empresa_id' => $empresaId, 'nombre' => $unidadAbrev, 'abreviatura' => strtoupper($unidadAbrev), 'activo' => true]);
                    $unidades[$key] = $nueva;
                }
                $unidadId = $unidades[$key]->id;
            }

            try {
                Producto::create([
                    'empresa_id'       => $empresaId,
                    'nombre'           => $nombre,
                    'codigo'           => $codigo      ? trim((string) $codigo)      : null,
                    'codigo_barra'     => $codigoBarra ? trim((string) $codigoBarra) : null,
                    'descripcion'      => $descripcion ? trim((string) $descripcion) : null,
                    'categoria_id'     => $categoriaId,
                    'marca_id'         => $marcaId,
                    'unidad_medida_id' => $unidadId,
                    'costo'            => $costo,
                    'precio_venta'     => $precioVenta,
                    'tasa_isv'         => is_numeric($tasaIsv) ? (float) $tasaIsv : 15,
                    'stock_minimo'     => is_numeric($stockMinimo) ? (int) $stockMinimo : 0,
                    'maneja_lote'       => false,
                    'maneja_vencimiento' => false,
                    'maneja_serie'      => false,
                    'activo'           => true,
                ]);
                $creados++;
            } catch (\Exception $e) {
                $errores[] = ['fila' => $fila, 'error' => "Error al crear «{$nombre}»: " . $e->getMessage()];
            }
        }

        return response()->json([
            'success' => true,
            'data'    => ['creados' => $creados, 'errores' => $errores],
            'message' => "{$creados} producto(s) importado(s) correctamente.",
        ]);
    }

    private static function parseNumero(mixed $value): ?float
    {
        if ($value === null || $value === '') return null;

        // PhpSpreadsheet puede devolver float directamente
        if (is_float($value) || is_int($value)) return (float) $value;

        $str = trim((string) $value);

        // Quitar símbolos de moneda, espacios y caracteres no numéricos excepto . , -
        $str = preg_replace('/[^\d.,-]/', '', $str);

        if ($str === '' || $str === '-') return null;

        // Detectar si la coma es separador decimal (e.g. "150,00") o de miles (e.g. "1,500.00")
        $hasDot   = str_contains($str, '.');
        $hasComma = str_contains($str, ',');

        if ($hasComma && $hasDot) {
            // Ambos: el que aparece último es el decimal
            $lastDot   = strrpos($str, '.');
            $lastComma = strrpos($str, ',');
            if ($lastComma > $lastDot) {
                // Coma es decimal: "1.500,99" → quitar puntos, cambiar coma por punto
                $str = str_replace(['.', ','], ['', '.'], $str);
            } else {
                // Punto es decimal: "1,500.99" → quitar comas
                $str = str_replace(',', '', $str);
            }
        } elseif ($hasComma && !$hasDot) {
            // Solo coma: puede ser decimal "150,00" o miles "1,500"
            $parts = explode(',', $str);
            $last  = end($parts);
            // Si la parte después de la coma tiene exactamente 2-3 dígitos → decimal
            if (strlen($last) <= 3 && count($parts) === 2) {
                $str = str_replace(',', '.', $str);
            } else {
                $str = str_replace(',', '', $str);
            }
        }

        return is_numeric($str) ? (float) $str : null;
    }
}
