# Configuración y despliegue — BV Bahía Archers League

Todo lo necesario para levantar el proyecto de cero, en local y en producción, sin información externa.

---

## 1. Requisitos

- **Node** ≥ 20 LTS
- **pnpm** ≥ 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- **MongoDB**: cuenta en [MongoDB Atlas](https://cloud.mongodb.com) (el tier M0 es gratuito y suficiente para empezar), o una instancia local **en modo replica set**
- **Docker** (solo para probar la imagen de producción localmente)

> **Por qué replica set incluso en local.** Las transacciones multi-documento de MongoDB requieren un replica set. Una instancia standalone hace que crear un torneo y publicar dejen de ser atómicos, y que los tests de transacciones no puedan correr. Ver §4.2 para el setup local.

---

## 2. Variables de entorno

`.env` en la raíz. **Nunca se commitea.** El repositorio incluye `.env.example` con la misma estructura y valores de ejemplo.

### Backend (`@bal/api`)

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `production` en el deploy |
| `PORT` | no | `8787` | Puerto del servidor. **En Railway no se setea**: lo inyecta la plataforma |
| `MONGODB_URI` | **sí** | — | Connection string de Atlas. Incluye usuario, password y `?retryWrites=true&w=majority` |
| `MONGODB_DB` | no | `bal` | Nombre de la base |
| `SESSION_SECRET` | **sí** | — | ≥ 32 caracteres. `openssl rand -hex 32` |
| `PIN_ENC_KEY` | **sí** | — | Clave AES-256 en hex (64 caracteres = 32 bytes). `openssl rand -hex 32`. Ver [`SECURITY.md`](SECURITY.md) §9 |
| `ADMIN_USERNAME` | no | `admin` | Usuario del administrador inicial |
| `ADMIN_INITIAL_PASSWORD` | **sí en prod** | `CBA2026` (solo dev) | Password del seed. **El arranque falla en producción si no está** |
| `SESSION_COOKIE_NAME` | no | `bal_session` | Nombre de la cookie de sesión |
| `CSRF_COOKIE_NAME` | no | `bal_csrf` | Nombre de la cookie CSRF |
| `COOKIE_SECURE` | no | `false` dev / `true` prod | Flag `Secure` de las cookies |
| `SESSION_TTL_HOURS_ADMIN` | no | `12` | Vigencia de la sesión de admin |
| `SESSION_TTL_HOURS_PATROL` | no | `24` | Máximo de la sesión de patrulla |
| `RATE_LIMIT_LOGIN` | no | `10` | Intentos de login por ventana e IP |
| `RATE_LIMIT_LOGIN_WINDOW_MIN` | no | `15` | Ventana de login, en minutos |
| `RATE_LIMIT_SYNC` | no | `300` | Ops de sync por minuto y sesión. **Generoso a propósito** |
| `RATE_LIMIT_PUBLIC` | no | `120` | Requests públicos por minuto e IP |
| `WEB_DIST_APP` | no | `public/app` | Ruta del build de la PWA |
| `WEB_DIST_LANDING` | no | `public/landing` | Ruta del build de la landing |
| `LOG_LEVEL` | no | `info` | `debug` · `info` · `warn` · `error` |

### Frontend (build-time, prefijo `VITE_`)

| Variable | Ámbito | Default | Descripción |
|---|---|---|---|
| `VITE_API_BASE` | app, landing | `/api` | Base de la API. Relativa en el monolito; URL absoluta si algún día se separan los repos |
| `VITE_APP_NAME` | app | `Liga Bahiense` | Nombre en el manifest de la PWA |
| `__APP_VERSION__` | app | de `package.json` | Inyectada por Vite. Se muestra en la UI para diagnóstico en el campo |

### Generar los secretos

```bash
openssl rand -hex 32
```

Se necesitan **dos** valores distintos: uno para `SESSION_SECRET` y otro para `PIN_ENC_KEY`. No reutilizar el mismo.

> **Advertencia sobre `PIN_ENC_KEY`.** Si esta clave se pierde o se cambia, los PINs cifrados existentes dejan de poder mostrarse. Los logins siguen funcionando (usan `pinHash`), pero el admin tendrá que regenerar cada PIN. Guardala junto con el resto de los secretos del proyecto.

---

## 3. Setup de MongoDB Atlas

1. **Crear cuenta y cluster** en [cloud.mongodb.com](https://cloud.mongodb.com). Elegir **M0 (Free)** para empezar. Región: la más cercana a la de Railway (`us-east` suele ser la mejor combinación).
2. **Database Access** → *Add New Database User*. Autenticación por password. Rol: **`readWrite` sobre la base `bal` únicamente** — nunca `atlasAdmin`.
3. **Network Access** → *Add IP Address*.
   - Para desarrollo: agregar tu IP.
   - Para Railway: Railway no publica un rango fijo de IPs de salida. Opciones, en orden de preferencia:
     - **a) Recomendada:** habilitar *Private Endpoint* / peering si el tier lo permite.
     - **b)** Usar `0.0.0.0/0` **junto con** un usuario de permisos mínimos y un password fuerte (≥ 32 caracteres aleatorios). El acceso queda protegido por credenciales y TLS. Es la opción viable en M0.
   - Documentar cuál se eligió y por qué.
4. **Connect** → *Drivers* → copiar el connection string:
   ```
   mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
5. **Backups**: en M0 no hay backup automático. Ver §9.

> Atlas es replica set desde el tier M0, así que las transacciones funcionan sin configuración adicional.

---

## 4. Setup local

### 4.1 Instalación

```bash
pnpm install
cp .env.example .env
```

Editar `.env` con el `MONGODB_URI` y los secretos generados.

### 4.2 MongoDB local como replica set (alternativa a Atlas en desarrollo)

**Con Docker (recomendado):**

```bash
docker run -d --name bal-mongo -p 27017:27017 mongo:7 --replSet rs0
```

```bash
docker exec bal-mongo mongosh --eval "rs.initiate()"
```

Connection string: `mongodb://localhost:27017/bal?replicaSet=rs0&directConnection=true`

**Sin Docker:** instalar MongoDB 7 y arrancar con `mongod --replSet rs0`, luego `rs.initiate()` desde `mongosh`.

### 4.3 Inicializar la base

```bash
pnpm --filter @bal/api db:indexes
```

```bash
pnpm --filter @bal/api db:seed
```

`db:indexes` crea todos los índices de [`TECHNICAL.md`](TECHNICAL.md) §2 de forma idempotente. `db:seed` crea el usuario administrador y una temporada de ejemplo.

### 4.4 Levantar

```bash
pnpm dev
```

- API en `http://localhost:8787`
- App (WAFA + WAFL) en `http://localhost:5173`
- Landing en `http://localhost:5174`

Ambos frontends proxean `/api` al backend en desarrollo (configurado en sus `vite.config.ts`).

### 4.5 Otros comandos útiles

```bash
pnpm --filter @bal/api db:reset
```
Borra todas las colecciones y vuelve a sembrar. **Solo desarrollo** — falla si `NODE_ENV=production`.

```bash
pnpm --filter @bal/api db:reconcile
```
Recalcula todos los rollups de `participants` desde `scores`. Red de seguridad ante cualquier desalineación.

---

## 5. Build de producción

```bash
pnpm build
```

Orden: `@bal/shared` → `@bal/api` + `@bal/app` + `@bal/landing`. Los builds de los frontends se copian a `packages/api/public/{app,landing}` y el backend los sirve.

```bash
pnpm start
```

---

## 6. Docker

Multi-stage, imagen final slim y sin herramientas de build:

```dockerfile
# 1) deps    — pnpm install --frozen-lockfile
# 2) build   — pnpm build (shared → api + app + landing)
# 3) runner  — node:20-bookworm-slim
#              · copia dist de api + public/{app,landing} + node_modules de producción
#              · USER node   (no root)
#              · EXPOSE ${PORT}
#              · HEALTHCHECK  →  /api/health
```

Como MongoDB es externo, **no hace falta ningún volumen persistente** y no hay binarios nativos que compilar. La imagen es notablemente más simple que la de un proyecto con SQLite.

```bash
docker build -t bal .
```

```bash
docker run -p 8787:8787 -e MONGODB_URI="mongodb+srv://..." -e SESSION_SECRET="..." -e PIN_ENC_KEY="..." -e ADMIN_INITIAL_PASSWORD="..." -e NODE_ENV=production -e COOKIE_SECURE=true bal
```

---

## 7. Deploy en Railway

1. **Crear proyecto** → *New Project* → *Deploy from GitHub repo*. Railway detecta `railway.json` y construye con el `Dockerfile`.

2. **Variables** (Settings → Variables):
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=bal
   SESSION_SECRET=<openssl rand -hex 32>
   PIN_ENC_KEY=<openssl rand -hex 32>
   ADMIN_INITIAL_PASSWORD=<password fuerte, ≥ 12 caracteres>
   COOKIE_SECURE=true
   ```
   **No setear `PORT`**: Railway lo inyecta y la API escucha en `process.env.PORT`.

3. **Dominio**: Settings → Networking → *Generate Domain*. HTTPS lo gestiona Railway.

4. **Healthcheck**: ya configurado en `railway.json` apuntando a `/api/health`.

5. **Primer arranque**: los índices se crean automáticamente y el usuario administrador se siembra con `ADMIN_INITIAL_PASSWORD`. **Entrar de inmediato y cambiar el password** — la app lo va a exigir.

6. **Verificación post-deploy**:
   ```bash
   curl -i https://<tu-dominio>/api/health
   ```
   Debe responder 200 con `db: "ok"` y traer las cabeceras de seguridad de [`SECURITY.md`](SECURITY.md) §10.

`railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 8. CI

`.github/workflows/ci.yml`. En cada pull request:

| Job | Pasos | Bloquea el merge |
|---|---|---|
| `quality` | `pnpm install --frozen-lockfile` → `biome check` → `typecheck` → `test` | **Sí** |
| `e2e` | Playwright (Chromium) contra el stack real con Mongo efímero | **Sí** |
| `audit` | `pnpm audit --audit-level=high` | **Sí** ante crítico o alto |
| `budget` | Verifica los presupuestos de tamaño de bundle de `TECHNICAL.md` §5 | **Sí** |

Los tests de integración usan `mongodb-memory-server` en modo replica set. Los E2E levantan un Mongo en Docker dentro del runner.

---

## 9. Backups

M0 no incluye backup automático. La liga corre 12 torneos al año y el dataset es chico, así que un backup manual programado alcanza y sobra.

**Manual:**
```bash
mongodump --uri="$MONGODB_URI" --db=bal --archive=bal-$(date +%F).gz --gzip
```

**Restaurar:**
```bash
mongorestore --uri="$MONGODB_URI" --archive=bal-2026-08-10.gz --gzip --drop
```

**Recomendación operativa:** correr `mongodump` **después de publicar cada torneo**. Es el momento en que hay datos nuevos que no se pueden reconstruir. Guardar el archivo fuera de Atlas y fuera de Railway.

Al pasar a M10 o superior, Atlas provee backups continuos con point-in-time recovery y esto queda obsoleto.

---

## 10. Checklist de puesta en producción

- [ ] Cluster de Atlas creado, con usuario de permisos mínimos (`readWrite` solo sobre `bal`).
- [ ] Network Access configurado y la decisión documentada.
- [ ] `SESSION_SECRET` y `PIN_ENC_KEY` generados con `openssl rand -hex 32`, **distintos entre sí**, guardados fuera del repositorio.
- [ ] `ADMIN_INITIAL_PASSWORD` fuerte, seteado en Railway, **nunca** `CBA2026`.
- [ ] `COOKIE_SECURE=true`.
- [ ] `PORT` **no** seteado en Railway.
- [ ] Dominio generado y respondiendo por HTTPS.
- [ ] `/api/health` responde 200 con `db: "ok"`.
- [ ] Cabeceras de seguridad presentes (verificar con `curl -i`).
- [ ] Password de admin cambiado en el primer login.
- [ ] Checklist completo de [`SECURITY.md`](SECURITY.md) §13 verde.
- [ ] Backup de prueba tomado y **restauración verificada** (un backup sin restore probado no es un backup).
- [ ] PWA instalable verificada en un Android y en un iPhone reales.
- [ ] **Prueba de campo:** un recorrido completo en modo avión, de punta a punta, en un dispositivo real. Esto no es opcional.
