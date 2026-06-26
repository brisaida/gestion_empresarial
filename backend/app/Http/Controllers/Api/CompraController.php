<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Inventory\StoreCompraRequest;
use App\Http\Resources\CompraResource;
use App\Models\Compra;
use App\Models\DetalleCompra;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class CompraController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    public function index(Request $request): JsonResponse
    {
        $query = Compra::with(['proveedor', 'bodega'])
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('proveedor_id')) {
            $query->where('proveedor_id', $request->integer('proveedor_id'));
        }

        if ($request->filled('search')) {
            $q = '%' . $request->search . '%';
            $query->where(function ($sub) use ($q) {
                $sub->where('numero_factura', 'ilike', $q)
                    ->orWhereHas('proveedor', fn($p) => $p->where('nombre', 'ilike', $q));
            });
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_compra', '>=', $request->fecha_desde);
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_compra', '<=', $request->fecha_hasta);
        }

        $data = $query->orderByDesc('fecha_compra')->orderByDesc('id')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => CompraResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(StoreCompraRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $compra = DB::transaction(function () use ($validated, $request) {
            $subtotal = collect($validated['detalles'])->sum(fn($d) => $d['cantidad'] * $d['costo_unitario']);
            $descuento = $validated['descuento'] ?? 0;
            $impuesto  = $validated['impuesto'] ?? 0;

            $compra = Compra::create([
                'empresa_id'     => $validated['empresa_id'],
                'proveedor_id'   => $validated['proveedor_id'],
                'bodega_id'      => $validated['bodega_id'],
                'usuario_id'     => $request->user()->id,
                'numero_factura' => $validated['numero_factura'] ?? null,
                'fecha_compra'   => $validated['fecha_compra'],
                'subtotal'       => $subtotal,
                'descuento'      => $descuento,
                'impuesto'       => $impuesto,
                'total'          => $subtotal - $descuento + $impuesto,
                'estado'         => 'pendiente',
            ]);

            foreach ($validated['detalles'] as $det) {
                DetalleCompra::create([
                    'compra_id'        => $compra->id,
                    'producto_id'      => $det['producto_id'],
                    'cantidad'         => $det['cantidad'],
                    'costo_unitario'   => $det['costo_unitario'],
                    'subtotal'         => $det['cantidad'] * $det['costo_unitario'],
                    'lote'             => $det['lote'] ?? null,
                    'fecha_vencimiento' => $det['fecha_vencimiento'] ?? null,
                ]);
            }

            return $compra;
        });

        $compra->load(['proveedor', 'bodega', 'detalles.producto']);
        return $this->created(new CompraResource($compra));
    }

    public function show(Compra $compra): JsonResponse
    {
        $compra->load(['proveedor', 'bodega', 'detalles.producto']);
        return response()->json(['success' => true, 'data' => new CompraResource($compra)]);
    }

    /**
     * Marca la compra como recibida y actualiza el stock.
     */
    public function recibir(Compra $compra, Request $request): JsonResponse
    {
        if ($compra->estado !== 'pendiente') {
            return $this->error("La compra ya está en estado '{$compra->estado}'.", 409);
        }

        try {
            DB::transaction(function () use ($compra, $request) {
                $compra->update(['estado' => 'recibida']);
                $compra->load('detalles');
                $this->inventario->procesarCompra($compra, $request->user()->id);
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $compra->load(['proveedor', 'bodega', 'detalles.producto']);
        return response()->json(['success' => true, 'message' => 'Compra recibida y stock actualizado.', 'data' => new CompraResource($compra)]);
    }

    public function cancelar(Compra $compra): JsonResponse
    {
        if ($compra->estado !== 'pendiente') {
            return $this->error("Solo se pueden cancelar compras pendientes.", 409);
        }
        $compra->update(['estado' => 'cancelada']);
        return response()->json(['success' => true, 'message' => 'Compra cancelada.', 'data' => new CompraResource($compra)]);
    }

    public function escanearFactura(Request $request): JsonResponse
    {
        $request->validate([
            'imagen'     => 'required|string',
            'media_type' => 'required|in:image/jpeg,image/png,image/gif,image/webp,application/pdf',
        ]);

        $apiKey = config('services.anthropic.key');
        if (!$apiKey) {
            return $this->error('El servicio de IA no está configurado. Agrega ANTHROPIC_API_KEY en el .env del servidor.', 503);
        }

        $prompt = <<<'PROMPT'
Analiza esta imagen de factura de compra y extrae los datos en el siguiente formato JSON exacto.
Responde ÚNICAMENTE con el JSON, sin texto adicional, sin bloques de código.

{
  "proveedor": "nombre del proveedor o vendedor (string o null)",
  "proveedor_rtn": "RTN, NIT o número de identificación fiscal del proveedor (string o null)",
  "proveedor_telefono": "teléfono del proveedor (string o null)",
  "proveedor_correo": "correo electrónico del proveedor (string o null)",
  "numero_factura": "número de factura (string o null)",
  "fecha": "YYYY-MM-DD (string o null)",
  "items": [
    {
      "codigo": "código, SKU o referencia del producto (string o null)",
      "descripcion": "nombre limpio del producto sin códigos ni referencias",
      "cantidad": 1,
      "precio_unitario": 0.00
    }
  ],
  "subtotal": 0.00,
  "impuesto": 0.00,
  "descuento": 0.00,
  "total": 0.00
}

Reglas:
- Usa null cuando un campo no sea visible o no aplique.
- Para números usa punto como separador decimal (ej: 125.50).
- Si el ISV/impuesto aparece como porcentaje, calcula el monto.
- items debe ser un array aunque solo haya un producto.
- En "descripcion" escribe SOLO el nombre comercial del producto. Si la línea empieza con un código alfanumérico (SKU, referencia, código de barra), ponlo en "codigo" y no lo incluyas en "descripcion". Ejemplo: "KV6PK6400901608 6-PACK - HEINEKEN LAGER" → codigo: "KV6PK6400901608", descripcion: "6-PACK - HEINEKEN LAGER".
- La "L" antes de un número es el símbolo de Lempiras (moneda hondureña), NO es el dígito 1. Elimínala al extraer cualquier monto. Ejemplo: "L198.00" → 198.00, NUNCA 1198.00.
- Las facturas hondureñas suelen tener columnas: UDM (unidad de medida, ej. CJ, UND), CANT (cantidad), PRECIO (precio unitario), DESCUENTO, ISV, TOTAL. Extrae "cantidad" del campo CANT y "precio_unitario" del campo PRECIO. El campo UDM (como "CJ-1" o "UND") NO es la cantidad.
- Verifica que cantidad × precio_unitario ≈ total de la línea. Si no cuadra, revisa que no estés confundiendo columnas.
PROMPT;

        $response = Http::withHeaders([
            'x-api-key'         => $apiKey,
            'anthropic-version' => '2023-06-01',
            'content-type'      => 'application/json',
        ])->timeout(45)->post('https://api.anthropic.com/v1/messages', [
            'model'      => 'claude-haiku-4-5-20251001',
            'max_tokens' => 1024,
            'messages'   => [[
                'role'    => 'user',
                'content' => [
                    [
                        'type'   => $request->media_type === 'application/pdf' ? 'document' : 'image',
                        'source' => [
                            'type'       => 'base64',
                            'media_type' => $request->media_type,
                            'data'       => $request->imagen,
                        ],
                    ],
                    ['type' => 'text', 'text' => $prompt],
                ],
            ]],
        ]);

        if (!$response->successful()) {
            $msg = $response->json('error.message') ?? 'Error al consultar el servicio de IA.';
            return $this->error($msg, 502);
        }

        $text = $response->json('content.0.text', '');

        // Extrae el JSON aunque el modelo agregue texto extra
        if (preg_match('/\{.*\}/s', $text, $m)) {
            $text = $m[0];
        }

        $data = json_decode($text, true);
        if (!is_array($data)) {
            return $this->error('No se pudo interpretar la respuesta del modelo. Intenta con una imagen más clara.', 422);
        }

        return response()->json(['success' => true, 'data' => $data]);
    }
}
