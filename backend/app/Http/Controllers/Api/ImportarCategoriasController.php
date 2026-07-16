<?php

namespace App\Http\Controllers\Api;

use App\Models\Categoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportarCategoriasController extends ApiController
{
    public function plantilla(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Categorías');

        $headers = ['A1' => 'nombre *', 'B1' => 'descripcion'];
        foreach ($headers as $cell => $value) {
            $sheet->setCellValue($cell, $value);
        }

        $sheet->fromArray(['Bebidas', 'Refrescos y jugos'], null, 'A2');
        $sheet->fromArray(['Snacks', 'Papas, galletas y similares'], null, 'A3');
        $sheet->fromArray(['Electrónicos', ''], null, 'A4');

        $sheet->getStyle('A1:B1')->applyFromArray([
            'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill'      => ['fillType' => 'solid', 'startColor' => ['rgb' => '072B5A']],
            'alignment' => ['horizontal' => 'center'],
        ]);

        foreach (range('A', 'C') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, 'plantilla_categorias.xlsx', [
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

        $headerRow = array_map(fn($h) => strtolower(trim((string) $h)), $rows[0]);
        $cols = [];

        $mapaCampos = [
            'nombre'      => ['nombre'],
            'descripcion' => ['descripcion', 'descripción', 'detalle'],
        ];

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

        if (!isset($cols['nombre'])) {
            return $this->error('No se encontró la columna «nombre». Asegúrate de usar la plantilla proporcionada.', 422);
        }

        $get = fn($row, $campo) => isset($cols[$campo]) ? ($row[$cols[$campo]] ?? null) : null;

        $existentes = Categoria::where('empresa_id', $empresaId)
            ->pluck('nombre')
            ->map(fn($n) => strtolower(trim($n)))
            ->flip()
            ->all();

        $creados  = 0;
        $omitidas = 0;
        $errores  = [];

        foreach ($rows as $index => $row) {
            $fila = $index + 1;

            if ($fila === 1 || empty(array_filter($row, fn($v) => $v !== null && $v !== ''))) continue;

            $nombre = trim((string) $get($row, 'nombre'));

            if (!$nombre) {
                $errores[] = ['fila' => $fila, 'error' => 'El nombre es requerido.'];
                continue;
            }

            if (isset($existentes[strtolower($nombre)])) {
                $omitidas++;
                continue;
            }

            $descripcion = $get($row, 'descripcion');

            try {
                Categoria::create([
                    'empresa_id'  => $empresaId,
                    'nombre'      => $nombre,
                    'descripcion' => $descripcion !== null && $descripcion !== '' ? trim((string) $descripcion) : null,
                    'activo'      => true,
                ]);
                $existentes[strtolower($nombre)] = true;
                $creados++;
            } catch (\Exception $e) {
                $errores[] = ['fila' => $fila, 'error' => "Error al crear «{$nombre}»: " . $e->getMessage()];
            }
        }

        return response()->json([
            'success' => true,
            'data'    => ['creados' => $creados, 'omitidas' => $omitidas, 'errores' => $errores],
            'message' => "{$creados} categoría(s) importada(s) correctamente.",
        ]);
    }

}
