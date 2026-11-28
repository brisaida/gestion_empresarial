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
**Tests:** `php artisan test` runs on in-memory SQLite — avoid Postgres-only SQL (`ilike`, `::casts`) in code paths covered by tests; use `lower(x) like ?`.  
**Production:** Railway. Pushing to `main` auto-deploys; migrations run in `docker-entrypoint-prod.sh`. Never commit/push/deploy without the owner's explicit OK. User-facing changes go in `CHANGELOG.md`.

## Architecture

### Multi-empresa system (a product sold to many companies)
The system is sold to different companies: build features generic and configurable per empresa (settings in `empresas` columns/JSON like `config_bancos`, `config_cotizacion`), never hard-coded for one client. Optional modules must stay invisible/no-op for companies that don't use them.

Every data record is scoped by `empresa_id`. Users belong to multiple companies with different roles per company. The frontend stores `state.empresaActiva` (current company) and every API request includes `empresa_id` as a parameter.

### Permission system (módulos)
Each role has a `modulos` JSON array: `null` = full access, otherwise an allowlist of strings (`ventas`, `compras`, `inventario`, `catalogos`, `cotizaciones`, `traslados`, `reportes`, `configuracion`, `finanzas`, `ver_costos`, `dashboard`). Roles are global (not per empresa) and managed by the super admin; the role is assigned per empresa in `usuarios_empresas`. The list of modules lives in `frontend/src/lib/modulos.ts`.

- **Backend:** `middleware('permiso:modulo')` → `TienePermiso.php` enforces it. OR syntax: `permiso:ventas|finanzas`. Inside controllers: `$request->user()->tienePermiso($empresaId, 'ventas|finanzas')`  
- **Frontend:** `usePermisos().hasPerm('modulo')` → `<Guard perm="modulo">` wraps routes  
- **Super admin:** `users.es_super_admin = true` bypasses all checks; has `/super-admin/*` routes

### Rubro system
`empresa.rubro` (`tienda`, `distribuidora`, `farmacia`, `ferreteria`) is informational; no feature is gated by it today.

The restaurant module (mesas, comandas, kitchen screen, recipes/ingredients, product `tipo`) was **removed** on 2026-11-28 (migration `quitar_modulo_restaurante`) to be developed separately. Its last full version is the git tag `restaurante-respaldo`. Don't re-add restaurant logic to this codebase.

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

**`recursos.ts`** — all API wrappers live here, grouped by resource (e.g. `productosApi`, `ventasApi`, `bancosApi`). The `list()` helper returns `PaginatedResponse<T>`, `get()` returns `ApiResponse<T>`.

**`types/index.ts`** — single source of truth for all TypeScript interfaces. Add new types here.

**`Table<T>` component:** Columns are `{ key, header: ReactNode, cell, width?, headerStyle? }`. Supports checkbox columns for bulk selection.

**Forms:** React Hook Form + Zod. Use `useForm<Schema>({ resolver: zodResolver(schema) })`. Reset with `reset(data)` in a `useEffect` when editing.

**Modals:** Use the `Modal` component with `open`, `onClose`, `title`, `size` props.

### Inventory deduction on sales
`InventarioService::procesarVenta()` deducts stock for every line with `producto_id` (free-text lines from quotations don't move stock). Before writing, `validarStockDisponible()` aggregates required amounts and throws `StockInsuficienteException` listing shortfalls and other warehouses with stock. Cancelling a sale calls `revertirVenta()`, which replays the exact exits as entries.

### Credit, payments and money flows
All ledgers follow the same rules: amounts are recalculated from their rows, and documents are **annulled** (`anulado`, `anulado_por`, `anulado_at`), never deleted. Services throw `DomainException` → 422.

- **Ventas al crédito / CxC** — `CreditoService`. `ventas.condicion = credito`, `saldo_pendiente`, `fecha_vencimiento` (days: cliente → empresa default). Abonos in `abonos_venta` (per factura, or a general abono split oldest-due first). Cash abonos add to the open caja.
- **Compras al crédito / CxP** — `CuentasPorPagarService`, `pagos_compra`.
- **Devoluciones** — `DevolucionService`: `devoluciones_venta` (DEV-) and `devoluciones_compra` (DPV-), proportional amounts, stock returns, refund to cash/saldo/card/bank. Cancelling a sale or purchase requires a `motivo`.
- **Tarjetas de crédito de la empresa** — `TarjetaService`: `cargos_tarjeta` generated from requisiciones/compras/supplier payments paid with `metodo_pago = tarjeta`; a compra linked to an already-charged requisición reuses that charge (no double charge). `pagos_tarjeta` = payments to the bank.
- **Bancos** — `BancoService`: `cuentas_bancarias` (HNL or USD), `movimientos_banco` with running balance. Sales/abonos/compras/pagos with tarjeta/transferencia/cheque create movements automatically on the selected account or the empresa default (`empresas.config_bancos`). POS commission per account. Documents are in lempiras, so only HNL accounts link to documents; USD accounts move by manual entries and transfers (`monto_destino`). Cash deposits subtract from the caja's expected cash (`SesionCajaController::calcularResumen`).
- **Reports** — margin is computed without ISV and net of returns (`DashboardController::devueltoPorLinea()`).

### Bitácora (audit log)
`BitacoraService` + trait `App\Models\Concerns\Auditable`. Models with the trait (listed in `BitacoraService::MODELOS`) are logged automatically on create/update/delete with before/after values; hidden fields (password, PIN, signature images) are masked. The update right after a create in the same request is merged into the "crear" row.
- **Add a new auditable model:** `use Auditable;` + add it to `BitacoraService::MODELOS` (module + readable name). Optional `bitacoraDebeRegistrar($evento)` to filter (e.g. only manual bank movements) and `bitacoraDescripcion()` for a custom label.
- **Mass updates** (`Model::where()->update()`) don't fire events: log them explicitly with `app(BitacoraService::class)->registrar(...)`. Bulk jobs (imports) run inside `BitacoraService::pausar()` and log one summary row.
- Logins/logouts/failed logins are logged with `empresa_id = null`, module `sesion`. Role/user changes are global too (only the super admin sees them).
- Screens: `/bitacora` (permiso `configuracion`, scoped to the empresa) and `/super-admin/bitacora` (everything).

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
| `backend/app/Services/CreditoService.php` · `CuentasPorPagarService.php` · `DevolucionService.php` · `TarjetaService.php` · `BancoService.php` | Money ledgers (see above) |
| `backend/app/Services/BitacoraService.php` | Audit log |
| `frontend/src/lib/modulos.ts` | Permission modules shown in the role editor |
| `CHANGELOG.md` | User-facing change history (update it with every feature) |
