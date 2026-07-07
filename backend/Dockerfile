FROM php:8.4-apache

# Dependencias del sistema y extensiones PHP
RUN apt-get update && apt-get install -y \
    libpq-dev libzip-dev libonig-dev \
    libpng-dev libjpeg-dev libfreetype-dev \
    unzip git curl \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install \
        pdo pdo_pgsql pgsql \
        zip bcmath mbstring gd opcache \
    && a2enmod rewrite headers \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# OPcache para producción
RUN { \
    echo 'opcache.enable=1'; \
    echo 'opcache.memory_consumption=128'; \
    echo 'opcache.validate_timestamps=0'; \
} > /usr/local/etc/php/conf.d/opcache.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Instalar dependencias PHP primero (capa cacheada)
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# Copiar código fuente
COPY . .
RUN composer dump-autoload --optimize --no-dev

# Directorio raíz de Apache → public/
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/public|g' \
        /etc/apache2/sites-available/000-default.conf \
    && echo '<Directory /var/www/html/public>\n    AllowOverride All\n    Require all granted\n</Directory>' \
        >> /etc/apache2/sites-available/000-default.conf \
    && echo "ServerName localhost" >> /etc/apache2/apache2.conf

RUN chmod -R 775 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache public

# Asegurar que solo mpm_prefork esté habilitado
RUN ls /etc/apache2/mods-enabled/mpm_* 2>/dev/null || true \
    && find /etc/apache2/mods-enabled -name 'mpm_*.load' ! -name 'mpm_prefork.load' -delete \
    && find /etc/apache2/mods-enabled -name 'mpm_*.conf' ! -name 'mpm_prefork.conf' -delete \
    && ls /etc/apache2/mods-enabled/mpm_* 2>/dev/null || true

COPY docker-entrypoint-prod.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

EXPOSE 80
ENTRYPOINT ["entrypoint"]
