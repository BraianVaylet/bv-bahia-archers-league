# ref-7 · Rediseño visual

Séptima ronda: hacer que la landing, la puerta `/app`, WAFA y WAFL se vean profesionales sin tocar ninguna regla operativa.

| Archivo | Para qué |
|---|---|
| [`INFORME.md`](INFORME.md) | Qué se encontró, con evidencia, y las **6 decisiones** a confirmar (§5) |
| [`ACTION_PLAN.md`](ACTION_PLAN.md) | Las 13 tandas `REF7-N`, en orden, con archivos, ítems y DoD. **Empezá por acá** |
| [`DISENO.md`](DISENO.md) | La especificación: tokens, tipografía, componentes y pantallas, con valores exactos y la copy literal |
| [`referencia/index.html`](referencia/index.html) | Las pantallas y los componentes propuestos, para abrir en el navegador (`?oscuro` muestra el tema oscuro) |
| [`referencia/capturas/`](referencia/capturas) | Renders de las pantallas a 1280 y 390 px |
| [`referencia/design-system-README.md`](referencia/design-system-README.md) | El brand book del Design System publicado (reglas de uso de cada token) |
| [`referencia/design-system-REDISENO.md`](referencia/design-system-REDISENO.md) | El resumen del plan tal como se entregó en el Design System |
| [`antes-despues/`](antes-despues/README.md) | Seis pantallas antes del rediseño y al cerrarlo (`REF7-12`) |

## Arranque rápido para una sesión nueva de Claude Code

```bash
git fetch origin
git checkout design/ref-7-rediseno
pnpm install
```

Después, el prompt:

> Leé `CLAUDE.md` y `docs/post/ref-7/ACTION_PLAN.md` (sección «Cómo retomar esto»). Confirmá conmigo las decisiones de `INFORME.md` §5 que afecten a la próxima tanda pendiente y hacé esa tanda siguiendo `DISENO.md`. Al terminar, marcala y anotala en la bitácora.

**Rama:** `design/ref-7-rediseno`, creada desde `main` (`07e5754`). Contiene **solo documentación**: ningún cambio de código.
