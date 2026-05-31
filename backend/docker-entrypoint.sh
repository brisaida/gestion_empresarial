#!/bin/sh
set -e

# Parchar .env con los valores de Docker (docker-compose environment toma precedencia)
if [ -n "$DB_HOST" ]; then
    sed -i "s|^DB_HOST=.*|DB_HOST=${DB_HOST}|" .env
fi
if [ -n "$DB_USERNAME" ]; then
    sed -i "s|^DB_USERNAME=.*|DB_USERNAME=${DB_USERNAME}|" .env
fi
if [ -n "$DB_PASSWORD" ]; then
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" .env
elif grep -q "^DB_PASSWORD=" .env; then
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD:-}|" .env
fi
if [ -n "$DB_DATABASE" ]; then
    sed -i "s|^DB_DATABASE=.*|DB_DATABASE=${DB_DATABASE}|" .env
fi

# Limpiar config cacheada para que tome los nuevos valores
php artisan config:clear --quiet 2>/dev/null || true

# Composer install si el named volume aún no tiene dependencias
if [ ! -f "vendor/autoload.php" ]; then
    echo "[backend] Instalando dependencias de composer..."
    composer install --no-interaction --optimize-autoloader
fi

# Permisos de escritura para Laravel
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

# Migraciones automáticas al levantar
echo "[backend] Ejecutando migraciones..."
php artisan migrate --force --no-interaction

echo "[backend] Listo en http://localhost:8000"
exec php artisan serve --host=0.0.0.0 --port=8000
