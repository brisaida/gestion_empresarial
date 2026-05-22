# Sistema de Inventario

Sistema de gestión de inventario construido con **Laravel 13 + React 19 + TypeScript**.

## Stack tecnológico

| Capa       | Tecnología                              |
|------------|-----------------------------------------|
| Backend    | Laravel 13, PHP 8.5, Sanctum, Spatie Permissions |
| Frontend   | React 19, TypeScript, Vite 6, Tailwind CSS v4 |
| Base datos | PostgreSQL 16                           |
| API        | REST + JSON Resources                   |

---

## Requisitos previos

- PHP 8.3+
- Composer
- Node.js 20+
- PostgreSQL 16+

---

## Instalación rápida

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd inventario
```

### 2. Configurar el Backend

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
```

Editar `backend/.env` con tus credenciales de PostgreSQL:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=inventario_db
DB_USERNAME=tu_usuario
DB_PASSWORD=tu_password
```

Crear la base de datos y correr migraciones:

```bash
# Crear la base de datos en PostgreSQL
psql -U postgres -c "CREATE DATABASE inventario_db;"

# Correr migraciones y seeders
php artisan migrate --seed
```

### 3. Configurar el Frontend

```bash
cd ../frontend
cp .env.example .env.local
npm install
```

El archivo `.env.local` apunta al backend por defecto:
```env
VITE_API_URL=http://localhost:8000
```

---

## Iniciar el proyecto

### Opción A — Script automático (ambos servicios)

```bash
# Desde la raíz del proyecto
./start.sh
```

### Opción B — Manual

```bash
# Terminal 1 — Backend
cd backend
php artisan serve --port=8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend / API:** http://localhost:8000
- **API Base URL:** http://localhost:8000/api

---

## Estructura del proyecto

```
inventario/
├── backend/                  # Laravel API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/  # Controladores API
│   │   │   ├── Requests/     # Form Requests (validación)
│   │   │   └── Resources/    # JSON Resources
│   │   ├── Models/           # Modelos Eloquent
│   │   └── Services/         # Lógica de negocio
│   ├── database/
│   │   ├── migrations/       # Migraciones
│   │   └── seeders/          # Datos de prueba
│   └── routes/
│       └── api.php           # Rutas de la API
│
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── api/              # Clientes HTTP (axios)
│   │   ├── components/       # Componentes reutilizables
│   │   │   ├── layout/       # Sidebar, Navbar, etc.
│   │   │   └── ui/           # Botones, inputs, tablas...
│   │   ├── hooks/            # Custom hooks
│   │   ├── pages/            # Vistas principales
│   │   ├── stores/           # Estado global
│   │   └── types/            # Tipos TypeScript
│   └── vite.config.ts
│
├── start.sh                  # Script para iniciar ambos servicios
└── README.md
```

---

## Módulos del sistema

- **Dashboard** — métricas y resumen de inventario
- **Productos** — CRUD con categorías y stock
- **Categorías** — clasificación de productos
- **Proveedores** — gestión de proveedores
- **Bodegas** — ubicaciones de almacenamiento
- **Movimientos** — entradas y salidas de inventario
- **Stock** — consulta de existencias actuales
- **Usuarios y Roles** — autenticación con permisos granulares
- **Reportes** — exportación y análisis

---

## Comandos útiles

```bash
# Backend
php artisan route:list              # Ver todas las rutas
php artisan make:model NombreModelo -mrc  # Modelo + migración + controlador
php artisan migrate:fresh --seed    # Reiniciar BD con datos de prueba

# Frontend
npm run build    # Build de producción
npm run preview  # Preview del build
```
