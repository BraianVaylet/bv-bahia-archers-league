# Imagen de producción de la Liga Bahiense de Arquería.
#
# Un solo contenedor sirve todo: la API en `/api`, la PWA en `/app/` y la landing
# en `/`. Un solo origen significa sin CORS y con cookies simples.
# Ver `docs/ARCHITECTURE.md` §3 y `docs/CONFIG.md` §6.
#
# MongoDB es externo (Atlas), así que no hace falta ningún volumen persistente.

# ── 1) Dependencias ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /repo

RUN corepack enable

# Sólo los manifiestos: así la capa de dependencias se reusa mientras no cambien,
# aunque cambie el código.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/app/package.json packages/app/
COPY packages/landing/package.json packages/landing/

RUN pnpm install --frozen-lockfile

# ── 2) Build ─────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /repo

COPY . .

# `@bal/shared` primero: los demás lo consumen desde su `dist`.
RUN pnpm build

# Los frontends se acomodan junto al `dist` de la API, que es donde los busca
# `middleware/estaticos.ts` cuando corre dentro de la imagen.
RUN mkdir -p packages/api/public \
  && cp -r packages/app/dist packages/api/public/app \
  && cp -r packages/landing/dist packages/api/public/landing

# Se descartan las dependencias de desarrollo: la imagen final no compila nada.
RUN pnpm install --frozen-lockfile --prod

# ── 3) Runner ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=8787

# `node` ya existe en la imagen base y no es root.
USER node

COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/package.json ./package.json
COPY --from=build --chown=node:node /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build --chown=node:node /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /repo/packages/api/node_modules ./packages/api/node_modules
COPY --from=build --chown=node:node /repo/packages/api/package.json ./packages/api/package.json
COPY --from=build --chown=node:node /repo/packages/api/dist ./packages/api/dist
COPY --from=build --chown=node:node /repo/packages/api/public ./packages/api/public

EXPOSE 8787

# Railway usa el `healthcheckPath` de `railway.json`; esto cubre a quien corra
# la imagen a mano.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/api/dist/index.js"]
