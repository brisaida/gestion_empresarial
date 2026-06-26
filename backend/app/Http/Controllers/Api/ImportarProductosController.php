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

        $rows    = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);
        $creados = 0;
        $errores = [];

        // Cache de catálogos para no consultar la BD por cada fila
        $categorias = Categoria::where('empresa_id', $empresaId)->get()->keyBy(fn($c) => strtolower(trim($c->nombre)));
        $marcas     = Marca::where('empresa_id', $empresaId)->get()->keyBy(fn($m) => strtolower(trim($m->nombre)));
        $unidades   = UnidadMedida::where('empresa_id', $empresaId)->get()->keyBy(fn($u) => strtolower(trim($u->abreviatura)));

        foreach ($rows as $index => $row) {
            $fila = $index + 1;

            // Saltar encabezado y filas vacías
            if ($fila === 1 || empty(array_filter($row))) continue;

            [$nombre, $codigo, $codigoBarra, $descripcion, $categoriaNombre,
             $marcaNombre, $unidadAbrev, $costo, $precioVenta, $tasaIsv, $stockMinimo] = array_pad($row, 11, null);

            $nombre = trim((string) $nombre);
            if (!$nombre) {
                $errores[] = ['fila' => $fila, 'error' => 'El nombre es requerido.'];
                continue;
            }

            $costo      = is_numeric($costo)      ? (float) $costo      : null;
            $precioVenta = is_numeric($precioVenta) ? (float) $precioVenta : null;

            if ($costo === null || $precioVenta === null) {
                $errores[] = ['fila' => $fila, 'error' => "Costo o precio de venta inválido en «{$nombre}»."];
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
}
