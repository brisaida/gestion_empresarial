#!/bin/sh
set -e

# ── Generar .env desde variables de entorno de Railway ──────────────────────
cat > .env <<EOF
APP_NAME=Inventario
APP_ENV=production
APP_KEY=${APP_KEY:-}
APP_DEBUG=false
APP_URL=${APP_URL:-http://localhost}

APP_LOCALE=es
APP_FALLBACK_LOCALE=es

LOG_CHANNEL=stderr
LOG_LEVEL=error

DB_CONNECTION=pgsql
DB_URL=${DATABASE_URL:-}
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-inventario_db}
DB_USERNAME=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-}
DB_SSLMODE=${DB_SSLMODE:-require}

SESSION_DRIVER=cookie
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=

SANCTUM_STATEFUL_DOMAINS=${SANCTUM_STATEFUL_DOMAINS:-}

FRONTEND_URL=${FRONTEND_URL:-*}

FILESYSTEM_DISK=local

ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
EOF

# ── Generar APP_KEY si no viene en las variables ─────────────────────────────
if [ -z "$APP_KEY" ]; then
    echo "[backend] Generando APP_KEY..."
    php artisan key:generate --force
fi

# ── Ajustar puerto de Apache (Railway inyecta PORT) ──────────────────────────
PORT=${PORT:-80}
sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

find /etc/apache2/mods-enabled -name 'mpm_*.load' ! -name 'mpm_prefork.load' -delete 2>/dev/null || true
find /etc/apache2/mods-enabled -name 'mpm_*.conf' ! -name 'mpm_prefork.conf' -delete 2>/dev/null || true

# ── Storage symlink ───────────────────────────────────────────────────────────
echo "[backend] Creando storage:link..."
php artisan storage:link --force

# ── Migraciones ───────────────────────────────────────────────────────────────
echo "[backend] Ejecutando migraciones..."
php artisan migrate --force --no-interaction

# ── Cachear configuración para producción ────────────────────────────────────
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "[backend] Iniciando Apache en puerto ${PORT}..."
exec apache2-foreground
