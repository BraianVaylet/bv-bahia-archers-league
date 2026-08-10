# BV Bahía Archers League

Sistema de organización y gestión de torneos de la **Liga Bahiense de Arquería** (CBA, Bahía Blanca).

La liga corre un torneo por mes durante la temporada. Los torneos son **multitarget**: un recorrido por el predio con N blancos, donde cada blanco tiene su propia modalidad — sala 18 m, aire libre, juego de campo o 3D — con su propio reglamento de flechas. Los arqueros se reparten en **patrullas** y el líder de cada una anota los puntajes desde el celular, caminando por el monte.

> **El requisito que manda sobre todo lo demás:** la app se usa mientras se compite, con guantes, al sol y sin señal confiable. **No puede dejar de funcionar.**

---

## Las tres aplicaciones

| App | Ruta | Quién | Qué hace |
|---|---|---|---|
| **Landing** | `/` | Público | Rankings de la liga, resultados de torneos, fichas de arqueros |
| **WAFA** | `/app/admin` | Administrador | Crea torneos, arma patrullas, publica resultados |
| **WAFL** | `/app/patrulla` | Líder de patrulla | **Anota los puntajes. Funciona sin conexión.** |

WAFA y WAFL son una PWA instalable. WAFL guarda todo en el dispositivo y sincroniza cuando hay señal.

---

## Stack

TypeScript en todo el monorepo · React 18 + Vite 6 + Tailwind 4 (PWA) · Hono + driver oficial de MongoDB · MongoDB Atlas · Zod · Vitest + Playwright · Docker sobre Railway.

```
packages/
  shared/    @bal/shared    dominio puro, sin I/O — scoring, patrullas, rankings
  api/       @bal/api       Hono + MongoDB
  app/       @bal/app       PWA: WAFA + WAFL (offline-first)
  landing/   @bal/landing   sitio público
```

---

## Arranque rápido

```bash
pnpm install
```

```bash
cp .env.example .env
```

Editar `.env` con el `MONGODB_URI` y los secretos. Después:

```bash
pnpm --filter @bal/api db:indexes && pnpm --filter @bal/api db:seed
```

```bash
pnpm dev
```

API en `:8787` · app en `:5173` · landing en `:5174`.

El detalle completo — incluido cómo levantar MongoDB local **como replica set**, que hace falta para las transacciones — está en [`docs/CONFIG.md`](docs/CONFIG.md).

---

## Documentación

Todo el proyecto está documentado antes de escribirse. **Empezá por [`docs/README.md`](docs/README.md)**, que es el índice.

Los cuatro que más importan:

- [`docs/FUNCTIONAL.md`](docs/FUNCTIONAL.md) — qué hace el sistema
- [`docs/OFFLINE_SYNC.md`](docs/OFFLINE_SYNC.md) — cómo funciona sin señal
- [`docs/SECURITY.md`](docs/SECURITY.md) — controles y checklist
- [`docs/ACTION_PLAN.md`](docs/ACTION_PLAN.md) — el backlog priorizado

Si vas a implementar, leé primero [`CLAUDE.md`](CLAUDE.md).

---

## Comandos

```bash
pnpm dev          # api + app + landing
pnpm build        # shared → api + app + landing
pnpm test         # todos los tests
pnpm test:e2e     # Playwright, incluye el flujo offline
pnpm lint         # Biome
pnpm typecheck    # tsc en todos los paquetes
```

---

## Licencia

Ver [`LICENSE`](LICENSE).
