<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Resources\Json\ResourceCollection;

abstract class ApiController extends Controller
{
    protected function success(
        mixed $data = null,
        string $message = 'OK',
        int $status = 200
    ): JsonResponse {
        $body = ['success' => true, 'message' => $message];

        if ($data instanceof JsonResource || $data instanceof ResourceCollection) {
            // Los resources se serializan solos; los envolvemos en data
            return $data->additional(['success' => true, 'message' => $message])
                        ->response()
                        ->setStatusCode($status);
        }

        if ($data !== null) {
            $body['data'] = $data;
        }

        return response()->json($body, $status);
    }

    protected function created(mixed $data = null, string $message = 'Creado correctamente.'): JsonResponse
    {
        return $this->success($data, $message, 201);
    }

    protected function noContent(string $message = 'Eliminado correctamente.'): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message], 200);
    }

    protected function error(string $message, int $status = 400): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message], $status);
    }
}
