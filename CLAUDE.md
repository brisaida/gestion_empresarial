# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Laravel 13, PHP 8.5)
```bash
cd backend
php artisan serve --port=8000       # Dev server
php artisan migrate                 # Run pending migrations
php artisan migrate:fresh --seed    # Reset DB with test data
php artisan test                    # PHPUnit tests
php artisan pint                    # PHP code formatting
php artisan route:list              # View all API routes
php artisan make:model Nombre -mrc  # Model + migration + controller
```

### Frontend (React 19, TypeScript, Vite 6)
```bash
cd frontend
npm run dev      # Dev server on http://localhost:5173
npm run build    # Production build (also type-checks)
npm run lint     # ESLint
npx tsc --noEmit # Type-check without build
```

### Quick start
```bash
./start.sh       # Starts both servers (or use two terminals)
```

**Ports:** Backend 8000 · Frontend 5173  
**DB:** PostgreSQL 16, database `inventario_db`, user `brisa` (macOS Homebrew superuser, no password)

## Architecture

### Multi-empresa system
Every data record is scoped by `empresa_id`. Users belong to multiple companies with different roles per company. The frontend stores `state.empresaActiva` (current company) and every API request includes `empresa_id` as a parameter.

### Permission system (módulos)
Each role has a `modulos` JSON array: `null` = full access, otherwise an allowlist of strings (`ventas`, `compras`, `inventario`, `catalogos`, `cotizaciones`, `traslados`, `reportes`, `configuracion`, `ver_costos`, `dashboard`).

- **Backend:** `middleware('permiso:modulo')` → `TienePermiso.php` enforces it  
- **Frontend:** `usePermisos().hasPerm('modulo')` → `<Guard perm="modulo">` wraps routes  
- **Super admin:** `users.es_super_admin = true` bypasses all checks; has `/super-admin/*` routes

### Rubro system
`empresa.rubro === 'restaurante'` gates restaurant-specific features. In the sidebar, nav items with `rubro: 'restaurante'` only appear for restaurant companies. In `VentasPage`, a tablet POS layout appears on `md:` screens when `esRestaurante`. Recipe-based selling, comandas (kitchen orders), and the `/cocina` screen are restaurant-only.

### Authentication flow
1. `POST /api/auth/login` → `{ token, usuario, empresas }`  
2. Token stored in localStorage; axios interceptor injects `Authorization: Bearer {token}` on every request  
3. 401 response → clear token → redirect `/login`

### Backend patterns

**Base controller** (`ApiController`): `success()`, `created()`, `noContent()`, `error()` helpers — use these instead of raw `response()->json()`.

**Service layer:** Business logic lives in `app/Services/`. `InventarioService::procesarVenta()` deducts stock and handles recipe ingredient explosion. `procesarCompra()` handles weighted average cost. Always call these inside `DB::transaction()` and catch `DomainException` to return a 422.

**Resources:** All controllers return JSON Resources (`ProductoResource`, `VentaResource`, etc.) — never return raw model arrays.

**Requests:** Validation lives in `app/Http/Requests/`. Controllers call `$request->validated()`.

### Frontend patterns

**`useCrud(api, { queryKey, empresaId, extraParams? })`** — standard hook for list/create/update/delete pages. Returns `{ data, meta, loading, page, setPage, search, setSearch, create, update, remove, error, setError }`. All mutations auto-invalidate the query.

**`recursos.ts`** — all API wrappers live here, grouped by resource (e.g. `productosApi`, `ventasApi`, `comandasApi`). The `list()` helper returns `PaginatedResponse<T>`, `get()` returns `ApiResponse<T>`.

**`types/index.ts`** — single source of truth for all TypeScript interfaces. Add new types here.

**`Table<T>` component:** Columns are `{ key, header: ReactNode, cell, width?, headerStyle? }`. Supports checkbox columns for bulk selection.

**Forms:** React Hook Form + Zod. Use `useForm<Schema>({ resolver: zodResolver(schema) })`. Reset with `reset(data)` in a `useEffect` when editing.

**Modals:** Use the `Modal` component with `open`, `onClose`, `title`, `size` props.

### Inventory / recipe deduction flow
When a sale includes a recipe line (`receta_id`), `InventarioService::procesarVenta()` explodes each ingredient × quantity and deducts stock. Before writing, `validarStockDisponible()` aggregates all required amounts and throws `DomainException` with a human-readable list of shortfalls if any ingredient is insufficient.

### Comanda / KDS flow
1. Mesero sends order → `POST /api/comandas` (no stock deduction yet)  
2. Kitchen marks items done → `PATCH /api/comandas/{id}/detalles/{det}/listo`  
3. When all items done → comanda auto-sets to `listo`  
4. Cashier bills the table → `POST /api/comandas/{id}/facturar` → creates `Venta`, deducts stock, marks comanda `cancelado`

### Key files
| File | Purpose |
|------|---------|
| `backend/routes/api.php` | All route definitions |
| `backend/app/Http/Middleware/TienePermiso.php` | Permission enforcement |
| `backend/app/Services/InventarioService.php` | Stock transactions, recipe deduction |
| `frontend/src/App.tsx` | Route tree, Guard components |
| `frontend/src/stores/authStore.tsx` | Global auth + empresa state |
| `frontend/src/hooks/useCrud.ts` | Reusable CRUD hook |
| `frontend/src/api/recursos.ts` | All API endpoint wrappers |
| `frontend/src/types/index.ts` | All TypeScript interfaces |
