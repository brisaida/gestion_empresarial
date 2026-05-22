<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UsuarioResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends ApiController
{
    public function login(LoginRequest $request): JsonResponse
    {
        if (!Auth::attempt(['correo' => $request->correo, 'password' => $request->password])) {
            return $this->error('Credenciales incorrectas.', 401);
        }

        $user = Auth::user();

        if (!$user->activo) {
            Auth::logout();
            return $this->error('Tu cuenta está desactivada. Contacta al administrador.', 403);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Sesión iniciada correctamente.',
            'data'    => [
                'token'  => $token,
                'usuario' => new UsuarioResource($user),
                'empresas' => $user->empresas()->where('usuarios_empresas.activo', true)->get()->map(fn($e) => [
                    'id'     => $e->id,
                    'nombre' => $e->nombre,
                    'rol'    => $e->pivot->rol_id,
                ]),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load([]);
        return response()->json([
            'success' => true,
            'data'    => new UsuarioResource($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return $this->noContent('Sesión cerrada correctamente.');
    }
}
