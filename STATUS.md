# Estado de `core-renderers`

**Última verificación**: 2026-08-11 · **Protocolo**: ver `STATUS-PROTOCOL.md` del directorio raíz.

Vocabulario: `IMPLEMENTADO` · `PARCIAL` · `PLANEADO` · `DESCARTADO`.
Toda fila `IMPLEMENTADO` o `PARCIAL` **debe citar un archivo**.

Auditoría completa: [docs/auditoria/2026-08-11-fase-2-core-renderers.md](docs/auditoria/2026-08-11-fase-2-core-renderers.md).

## Qué es este repo, en una línea

Cuatro renderers worker-only servidos como TypeScript crudo por un Vite de desarrollo en el
puerto 4174, que `luxsequencer-core` consume por URL a través de un proxy same-origin.

## Verificación ejecutada

| Comando | Resultado | Fecha |
|---|---|---|
| Type-check | **no existe** — no hay `tsconfig.json` en el repo | 2026-08-11 |
| Tests | **no existe** — no hay suite ni runner | 2026-08-11 |
| Lint | **no existe** — no hay configuración de ESLint | 2026-08-11 |
| `npm run validate` | `[catalog] ok` | 2026-08-11 |
| `npm run dev` | Vite 6.4.3 en 4174, listo en ~100 ms; sirve catálogo, manifests y `.ts` transpilados con CORS `*` | 2026-08-11 |
| `npx vite preview` | **arranca y devuelve 404 en todas las rutas** | 2026-08-11 |
| Visual (app real) | los 4 renderers dibujan; `dvd-screensaver` **invertido verticalmente** | 2026-08-11 |

Los tres gates estándar no están mal configurados: **no hay nada que los pueda correr**. Este repo
no compila; los `.ts` los transpila Vite al vuelo cuando el consumidor los pide.

## Capacidades

| Capacidad | Estado | Evidencia | Notas |
|---|---|---|---|
| Runtime worker-only, sin React ni DOM | IMPLEMENTADO | los 4 `src/renderers/*/*.worker.ts` | Sin excepciones; refactor `7053745` completo |
| Protocolo de worker v1.0.0 | IMPLEMENTADO | `WORKER_PROTOCOL_VERSION` en los 4 workers | Escrito a mano 4 veces, sin módulo compartido |
| Servidor HTTP con CORS en 4174 | IMPLEMENTADO | `vite.config.ts:9-23` | `strictPort`; 404 en `/` a propósito |
| Clave canónica `publisher/repo:kind/tool@major` | IMPLEMENTADO | `src/catalog.json`, los 4 `manifest.json` | Consistente en las 4 filas y con la allowlist de core |
| Schemas declarativos de controles | PARCIAL | los 4 `src/renderers/*/*-declarative-schema.ts` | Dos formas incompatibles conviviendo; controles declarados sin implementación (§ R3, R6, R7) |
| Catálogo del repositorio | PARCIAL | `src/catalog.json` | **Módulo huérfano**: nadie lo lee. Core duplica los manifests a mano |
| Manifests por herramienta | PARCIAL | `src/renderers/*/manifest.json` | **Módulos huérfanos**: core los tiene copiados literalmente en `index.ts:154-238` |
| Validación de catálogo | PARCIAL | `scripts/validate-catalog.mjs` | Sólo verifica que exista `manifestPath`; no valida claves, unicidad ni `workerEntry` |
| Contratos compartidos vía `@luxsequencer/contracts` | PARCIAL | `package.json:14` | `import type` puro; sin `tsconfig` nada lo verifica |
| Efectos de glitch en `dvd-screensaver` | PLANEADO | — | Schema publicado, cero implementación en worker y en core. Ver § R3 |
| Verificación estática (type-check / lint / tests) | PLANEADO | — | Ver § R5 |
| Canal de distribución de producción | PLANEADO | — | No hay build ni artefacto. Ver § R2 y los bloqueantes de la raíz |
| `npm run preview` | DESCARTADO de hecho | `package.json:9` | Script publicado que no puede funcionar: sirve un `dist/` que nunca se construye |

## Deuda crítica

1. **`dvd-screensaver` se dibuja invertido verticalmente** (R1). Confirmado en pantalla. El
   compositor de core aplica `UNPACK_FLIP_Y_WEBGL` a toda fuente
   (`luxsequencer-core/src/graphics-pipeline/WebGLCompositor.ts:228`); `diagnostic-fps` lo
   compensa a mano y `concentric` lo esconde por simetría. El arreglo es de contrato y se decide
   en la sesión de `luxsequencer-core`.

2. **No hay canal de distribución** (R2). El marketplace sólo existe mientras corra `vite dev`.
   Bloqueante del modelo de distribución, no se resuelve en este repo.

3. **8 controles de glitch declarados sin implementación en ninguno de los tres eslabones** (R3).

## Deuda no crítica

- **R4** — el worker `webgl` declara la capability `webgl2` y usa WebGL 1 (`scales.worker.ts:377` vs `:433`).
- **R5** — cero verificación estática sobre lo que se publica. La más barata de saldar.
- **R6** — dos formas de schema conviviendo; core mantiene dos extractores para soportarlas.
- **R7** — controles inertes: `animationDirection` de `concentric` y el gradiente de fondo de `concentric` (usa sólo el primer stop). `textureRotationSpeed` **no** es inerte: la integración velocidad→ángulo vive en el store de core, verificada.
- **R8** — `fetch()` arbitrario desde el worker de `dvd-screensaver` (`:143`), sin allowlist ni timeout.
- **R9** — `setInterval(16)` fijo; medido: 58.8 fps de render contra 31.0 updates/s de datos.
- **R10** — contrato de worker duplicado 4 veces, con divergencias reales entre copias.
- **R11** — [deriva de versiones](docs/auditoria/2026-08-06-drift-versiones.md): tres numeraciones conviviendo.

## Pendiente de rollout del protocolo

- **README sin recortar.** Tiene drift verificado en 5 puntos (D1–D5 de la auditoría): documenta
  `npm run preview` como funcional, describe un flujo de instalación con `npm link` y cuatro
  repos sueltos que ya no es la topología vigente, y arrastra un "Plan de contratos compartidos"
  cuya fase 1 está hecha desde el 2026-08-06. No se tocó en la sesión de auditoría por la regla
  de no arreglar documentación sobre la marcha.
- **`docs/next-steps/` no existe todavía** en este repo.
