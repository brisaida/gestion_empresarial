#!/bin/bash
# Inicia backend (Laravel) y frontend (Vite) en paralelo

export PATH="/Users/brisa/.local/bin:$PATH"

echo "========================================"
echo "  Sistema de Inventario - Iniciando..."
echo "========================================"

# Backend en background
echo ""
echo "[Backend] Iniciando Laravel en http://localhost:8000"
cd backend && php artisan serve --port=8000 &
BACKEND_PID=$!

# Frontend en background
echo "[Frontend] Iniciando Vite en http://localhost:5173"
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend  -> http://localhost:8000"
echo "  Frontend -> http://localhost:5173"
echo ""
echo "Presiona Ctrl+C para detener ambos servicios."
echo "========================================"

# Espera y maneja Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Servicios detenidos.'; exit 0" INT
wait
