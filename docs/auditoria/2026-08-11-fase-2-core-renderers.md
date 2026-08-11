> **Estado**: VIGENTE · **Última verificación**: 2026-08-11

# Auditoría de `core-renderers` — Fase 2

Sesión de auditoría por proyecto, con la metodología del `CLAUDE.md` de la raíz: código primero,
documentación después; cada afirmación de la doc es una hipótesis a verificar.

Todo lo que sigue está verificado contra el código, contra comandos corridos, o contra la app
levantada, el 2026-08-11 sobre `main` en `e2ac2ce`, con el árbol de trabajo limpio.

El repo es chico: **3180 líneas**, 4 renderers, 5 archivos `.ts`, 1 script de Node. Esa
proporción importa para leer el resto del informe: casi todo el peso de la integración vive del
lado de `luxsequencer-core`, no acá.

## 1. Estado real ejecutado

| Gate | Comando | Resultado |
|---|---|---|
| Type-check | — | **no existe**: no hay `tsconfig.json` en el repo |
| Tests | — | **no existe**: no hay suite ni runner |
| Lint | — | **no existe**: no hay configuración de ESLint |
| Validación | `npm run validate` | `[catalog] ok` |
| Servidor dev | `npm run dev` | Vite 6.4.3 en 4174, listo en ~100 ms |
| Servidor preview | `npx vite preview` | arranca, **404 en todas las rutas** |

Los tres gates estándar del ecosistema no están ausentes por olvido de configuración: **no hay
nada que los pueda correr**. Este repo no compila. Los `.ts` se sirven crudos y los transpila
Vite al vuelo cuando el consumidor los pide.

Verificación del servidor dev (con `curl` contra 4174):

| Ruta | Código | `content-type` |
|---|---|---|
| `/` | 404 | — (a propósito: no hay `index.html`) |
| `/src/catalog.json` | 200 | `application/json` |
| `/src/renderers/webgl/manifest.json` | 200 | `application/json` |
| `/src/renderers/webgl/scales.worker.ts` | 200 | `text/javascript` |
| `/src/renderers/webgl/scales-declarative-schema.ts` | 200 | `text/javascript` |
| `/src/renderers/dvd-screensaver/dvd-screensaver-declarative-schema.ts` | 200 | `text/javascript` |

Cabeceras CORS presentes y correctas (`Access-Control-Allow-Origin: *`, métodos `GET,HEAD,OPTIONS`).

Verificación visual: los 4 renderers se levantaron en la app real (core en 3000, marketplace en
4174, vía `npm run dev:all`) y los 4 dibujan. Ver § 5, R1: uno de ellos dibuja **al revés**.

## 2. Mapa de arquitectura desde el código

```
core-renderers/
├── package.json          4 scripts, 2 devDependencies, private: true
├── vite.config.ts        24 líneas: puerto 4174 strictPort + CORS, dev y preview
├── scripts/
│   └── validate-catalog.mjs   32 líneas
└── src/
    ├── catalog.json      4 entradas
    └── renderers/
        ├── webgl/            manifest.json + scales.worker.ts + scales-declarative-schema.ts
        ├── concentric/       manifest.json + *.worker.ts + *-declarative-schema.ts
        ├── dvd-screensaver/  ídem + README.md
        └── diagnostic-fps/   ídem
```

### Qué es realmente este repo

No es un paquete, ni una librería, ni un servidor de marketplace. Es **una carpeta de archivos
fuente con un servidor de desarrollo delante**. `private: true` y no hay `build`, `main`,
`exports` ni `files` en `package.json`.

### Cómo lo consume core

Dos caminos, ambos por URL, ambos vía el proxy same-origin `/marketplace-core-renderers`:

| Artefacto | Cómo llega | Punto de entrada en core |
|---|---|---|
| `*.worker.ts` | `new Worker(url)` | `marketplaceWorkerEntry.ts:13-29` |
| `*-declarative-schema.ts` | `await import(url)` dinámico | `index.ts:358-373` |
| `catalog.json` | **nunca se pide** | — |
| `manifest.json` | **nunca se pide** | — |

El proxy lo define core en su `vite.config.ts:13-17`, reescribiendo el prefijo. La URL base es
`VITE_MARKETPLACE_CORE_RENDERERS_BASE_URL`, con fallback
`/marketplace-core-renderers/src/renderers/` (`luxsequencer-core/src/config.ts:114`).

El rodeo del proxy existe porque el constructor `Worker` bloquea orígenes cruzados. El CORS del
`vite.config.ts` de este repo no alcanza para eso; por eso hay proxy *además* de CORS.

### Protocolo de worker

Los 4 workers implementan el mismo contrato, escrito a mano cuatro veces (no hay módulo
compartido):

- **Entrada**: `init { canvas: OffscreenCanvas, width, height }` · `resize` · `updateUniform { name, value }` · `dispose`.
- **Salida**: `ready { rendererId, protocolVersion, capabilities }` · `frame { bitmap }` (transferido) · `error { message }`.
- `WORKER_PROTOCOL_VERSION = '1.0.0'` en los 4, coincidente con `sdk.minWorkerProtocolVersion` de los 4 manifests.
- Los 4 dibujan con `setInterval(...)`, no con `requestAnimationFrame` — que no existe en un worker. `concentric`, `dvd-screensaver` y `webgl` usan un literal `16`; `diagnostic-fps` lo deriva de su uniform `targetFps`.

### Flujo de un frame

```
worker: setInterval → dibuja en OffscreenCanvas → transferToImageBitmap()
      → postMessage({type:'frame', bitmap}, [bitmap])
core:   RendererWorkerManager.onFrame → WebGLCompositor.setSourceFrame(source, bitmap)
      → texImage2D con UNPACK_FLIP_Y_WEBGL = 1   ← ver § 5, R1
      → composición A/B → canvas de la app
```

## 3. Tabla de drift

Afirmación de la doc │ realidad en el código │ evidencia.

| # | Afirmación | Realidad | Evidencia |
|---|---|---|---|
| D1 | `npm run preview` → "preview con misma configuración de CORS" | Arranca y devuelve **404 en todo**: sirve `dist/`, que nunca se construye | `README.md:96`; `npx vite preview` + `curl` |
| D2 | "Este repositorio puede exponerse como servidor HTTP para que la core app acceda a catálogo, manifests y assets" | Core nunca pide catálogo ni manifests. Cero coincidencias de `catalog` o `manifest.json` en `luxsequencer-core/src` | `README.md:91`; `grep` en core |
| D3 | "Clona los cuatro repositorios en la misma carpeta raíz" + `npm link lux-ui` | La topología vigente es submódulos + npm workspace con un `package-lock.json` único en la raíz. `npm link` no interviene | `README.md:23-41` vs `docs/decisiones/2026-08-06-topologia-repos.md` de la raíz |
| D4 | "`core-renderers` ya consume contratos compartidos desde `@luxsequencer/contracts` (dependencia local `file:../luxsequencer-contracts`)" | El rango es `^0.1.0` desde npm, no `file:`. Y el consumo es `import type` puro: desaparece en la transpilación | `README.md:113` vs `package.json:14`; salida del dev server |
| D5 | "Se inicializó el repositorio `../luxsequencer-contracts` con estructura base […] como punto de migración" — en presente, como trabajo pendiente | `@luxsequencer/contracts@0.1.0` está publicado en npm bajo MIT desde el 2026-08-06. La fase 1 del plan está hecha | `README.md:116`, `README.md:128-130` vs `STATUS.md` de la raíz |
| D6 | Release notes de `v0.1.0-beta.1` listan el renderer como `webgl-scale` | El id real es `webgl` en catálogo, manifest, worker y allowlist de core | `RELEASE_NOTES_v0.1.0-beta.1.md:17` vs `src/catalog.json:9` |
| D7 | Release notes listan 3 renderers | Hay 4: `diagnostic-fps` se agregó después de `v0.1.0-beta.2` | `git log 8915331` |
| D8 | "Actualmente, la core app mantiene una allowlist hardcodeada […] y valida su clave canónica antes de cargarlos" | **Cierto, y es lo único cierto del § de integración.** Se deja anotado como verificado | `luxsequencer-core/src/components/renderers/index.ts:147-240` |
| D9 | El catálogo llama al renderer `Concéntrico` | Core lo llama `Concénctrico` (con typo) en su allowlist, y ese es el nombre que ve el usuario | `src/catalog.json:20` vs `index.ts:197`; confirmado en pantalla |
| D10 | Manifests declaran `packageVersion: "0.6.0-beta"` | Es la versión de *core*, no la de este repo, que está en `0.1.0-beta.1` | ver [`2026-08-06-drift-versiones.md`](2026-08-06-drift-versiones.md) |

## 4. Código muerto e infraestructura desconectada

### `src/catalog.json` no tiene consumidores

Cero referencias en `luxsequencer-core/src`. En `luxsequencer-cloud` sólo aparece la clave
canónica `luxsequencer/core-renderers:renderer/webgl@1` como string literal en un smoke test
(`src/features/api-smoke/useApiSmoke.ts:75`), no leída del catálogo.

### Los 4 `manifest.json` tampoco

Core no los descarga: los tiene **copiados literalmente** dentro de `ALLOWED_RENDERERS`
(`index.ts:154-169`, `177-192`, `200-215`, `223-238`). Los manifests del repo y los objetos
`packageManifest` de core son dos copias del mismo dato, sin ningún mecanismo que las mantenga
sincronizadas. Hoy coinciden; nada garantiza que sigan coincidiendo.

### `scripts/validate-catalog.mjs` valida un artefacto que nadie lee

Y lo valida poco: comprueba que `tools` sea un array no vacío y que cada `manifestPath` apunte a
un archivo existente. **No** verifica el formato de la clave canónica, ni su unicidad, ni la
coherencia entre la clave del catálogo y los campos del manifest, ni que
`runtime.workerEntry` exista en disco. Un `workerEntry` roto pasa el gate.

### `@luxsequencer/contracts` es una dependencia decorativa

Se usa sólo con `import type` en los 4 schemas. La salida transpilada del dev server no contiene
ninguna referencia a contracts. Sin `tsconfig.json`, **nada verifica que los schemas cumplan
`RendererControlSpec` o `DeclarativeControlSchema`**. La dependencia está declarada y no la
ejercita ningún gate.

El commit `4428afc` ("inline dependency conditions for proxy-safe module loading") es la
consecuencia directa: hubo que inlinear `DependencyConditions` en cada schema porque un import
runtime hacia contracts no se resuelve del otro lado del proxy. Hoy ese objeto está duplicado en
`scales-declarative-schema.ts:8-13` y `dvd-screensaver-declarative-schema.ts:3-5`.

### `npm run preview` está roto

Ver D1. Es un script publicado y documentado que no puede funcionar: no hay `build` que produzca
el `dist/` que preview sirve.

## 5. Deuda y riesgos, por impacto

### R1 — `dvd-screensaver` se dibuja invertido verticalmente 🔴

**Confirmado en pantalla el 2026-08-11.** El texto "DVD" se ve espejado de arriba a abajo.

Cadena de causa:

1. El compositor sube **toda** fuente con `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)`, sin
   distinguir si el bitmap viene de un worker WebGL o de uno Canvas2D
   (`luxsequencer-core/src/graphics-pipeline/WebGLCompositor.ts:228`).
2. Para el worker WebGL (`webgl`) ese flip es correcto: compensa que el origen de GL es abajo a
   la izquierda.
3. Para un worker Canvas2D el flip está de más, porque su origen ya es arriba a la izquierda.
4. `diagnostic-fps` lo compensa a mano: `context2d.setTransform(1, 0, 0, -1, 0, canvas.height)`
   antes de dibujar (`diagnostic-fps.worker.ts:226`). **Esa línea es la prueba de que el flip
   llega a Canvas2D**, y en pantalla ese renderer se lee perfectamente derecho.
5. `concentric` no compensa, pero es radialmente simétrico: el defecto existe y es invisible.
   Verificado en pantalla — hexágonos concéntricos, indistinguibles al espejarse.
6. `dvd-screensaver` no compensa, y encima fuerza la identidad en `ensureViewport()`
   (`dvd-screensaver.worker.ts:123-129`), llamada en `init` y en `resize`. Es el único renderer
   con contenido asimétrico y legible, y es el único donde el defecto se ve.

**El arreglo correcto no va acá.** Que cada worker Canvas2D compense a mano es el mecanismo que ya
produjo esta inconsistencia. La orientación del bitmap debería ser parte del contrato de worker
(por ejemplo, que el worker declare su convención de origen en `ready`, o que el compositor
decida el flip según la capability `canvas2d` / `webgl`). Es una decisión de contrato que cruza
este repo y core: queda para la sesión de `luxsequencer-core`.

### R2 — No hay canal de distribución. El marketplace sólo existe como servidor de desarrollo 🔴

Este repo no puede servir a nadie sin `vite dev`. No hay build, no hay artefacto, no hay
`index.html`, y `preview` devuelve 404. Lo que se "publica" son fuentes TypeScript que dependen
de que el consumidor tenga un Vite corriendo del otro lado para transpilarlas.

Esto choca de frente con lo que el repo dice ser: un marketplace del que terceros consumen
herramientas. Un renderer de un tercero llegaría como `.ts` sin transpilar, cargado con
`import()` dinámico y `new Worker()`, sin sandbox ni verificación de integridad más allá de la
allowlist de claves canónicas.

Conecta con
[`docs/next-steps/bloqueantes-modelo-distribucion.md`](../../../docs/next-steps/bloqueantes-modelo-distribucion.md)
de la raíz. **No se resuelve acá**: es una decisión de modelo de distribución.

### R3 — La sección "Glitch" del schema de `dvd-screensaver` no está implementada en ningún lado 🔴

`dvd-screensaver-declarative-schema.ts:205-384` declara 8 controles bajo la categoría `Glitch`:
`chromaticAberration` (enabled + amount), `horizontalBands` (enabled + intensity + bandCount +
speed) y `channelFlicker` (enabled + probability + channel).

Trazando los tres eslabones:

| Eslabón | Estado |
|---|---|
| Schema publicado por este repo | Declara los 8 controles |
| Worker de este repo | **Cero código de glitch** |
| Tipos de core | Existen: `luxsequencer-core/src/types.ts:84-104` |
| Defaults de core | Existen: `luxsequencer-core/src/utils/settingsMigration.ts:354-370` |
| Payload que core envía al worker | **No los incluye**: sólo `assets`, `background`, `globalSpeed`, `globalRotationSpeed` (`GraphicsPipelineHost.tsx:323-328`) |

Son controles que se dibujan en el panel y no hacen nada. Es el patrón exacto que el `CLAUDE.md`
de la raíz llama drift: arquitectura planeada presentada como implementada, sólo que acá está en
el código y no en la doc — el schema *es* la interfaz publicada.

### R4 — El worker `webgl` declara la capability `webgl2` y usa WebGL 1 🟠

- `scales.worker.ts:377`: `canvas.getContext('webgl', ...)` — contexto WebGL 1.
- `scales.worker.ts:433`: anuncia `capabilities: ['offscreen-canvas', 'webgl2', 'uniform-updates']`.
- `luxsequencer-core/src/components/renderers/index.ts:153`: exige `'webgl2'`.

El chequeo de capacidades pasa porque el worker se autodeclara algo que no es. El shader es
GLSL ES 1.00 (`attribute`, `gl_FragColor`), consistente con WebGL 1; lo que está mal es la
etiqueta. El riesgo no es de hoy: es que el mecanismo de capabilities no verifica nada, así que
el día que un consumidor decida algo real en base a `webgl2` va a decidirlo con un dato falso.

### R5 — Cero verificación estática sobre el artefacto que se publica 🟠

Sin `tsconfig.json`, sin lint, sin tests. Los 5 archivos `.ts` que este repo entrega al mundo no
los mira nadie hasta que fallan en el navegador del consumidor. Un error de tipos en un schema se
manifiesta como un `catch {} → return null` silencioso en core (`index.ts:370-372`): el panel de
controles simplemente aparece vacío, sin diagnóstico.

Es la deuda más barata de saldar del informe: un `tsconfig.json` y un script `type-check` que
ejercite de verdad la dependencia a contracts.

### R6 — Dos formas de schema conviviendo sin criterio 🟠

| Renderer | Tipo | Forma | Líneas |
|---|---|---|---|
| `concentric` | `DeclarativeControlSchema` | `sections[]` + `presets` + `validation` + `metadata` | 429 |
| `webgl` | `RendererControlSpec` | `standard[]` | 359 |
| `dvd-screensaver` | `RendererControlSpec` | `standard[]` | 386 |
| `diagnostic-fps` | `RendererControlSpec` | `standard[]` | 132 |

Core soporta las dos con duck typing (`index.ts:46-56`: ¿tiene `sections`? ¿tiene `standard`?) y
tiene dos extractores paralelos de propiedades animables (`index.ts:73-110`). El comentario de
cabecera de `concentric-declarative-schema.ts:5-6` dice "Migrated from legacy schema system to
new declarative architecture" — pero es el único que quedó en esa forma, así que o la migración
fue al revés de lo que dice el comentario, o quedó a mitad de camino. **Pregunta abierta**, ver § 7.

Además, las dos formas usan espacios de identificadores distintos: `concentric` usa ids planos
(`repetitionSpeed`), los otros tres usan ids con namespace (`renderer.scales.scaleSize`,
`common.animationSpeed`). Ninguno de los dos coincide con los nombres de uniform que el worker
recibe (`scaleSize`, `animationSpeed`); la traducción vive en core, escrita a mano
(`GraphicsPipelineHost.tsx:336-350`).

### R7 — Controles declarados que no llegan al worker 🟡

Más allá del bloque Glitch de R3:

- **`concentric` → `animationDirection`**: el schema lo declara con 9 `valueLabels`
  (`concentric-declarative-schema.ts:283-304`); el tipo `ConcentricUniformSettings` del worker no
  tiene el campo y el payload de core no lo manda (`GraphicsPipelineHost.tsx:304-315`). Inerte.
- **`concentric` → `backgroundGradientColors`**: el schema ofrece hasta 10 colores con hard stops
  (`:253-261`); el worker usa **sólo el primer stop** como color plano
  (`concentric.worker.ts:162`). Confirmado en pantalla: fondo liso. El control promete un
  gradiente y entrega un color.
- **`webgl` → `textureRotationSpeed`**: el schema lo expone como *velocidad* bipolar −5..5
  (`scales-declarative-schema.ts:196-224`); el worker consume `textureRotation` como *ángulo
  absoluto en grados*, que mete directo en `rotate2d` (`scales.worker.ts:328`, shader `:129`).
  **La integración velocidad→ángulo existe y es correcta**: un bucle `requestAnimationFrame` en el
  store de core acumula `textureRotation += speed * 0.5` módulo 360
  (`luxsequencer-core/src/store/slices/project.slice.ts:143-149`), y de ahí sale el
  `state.textureRotation` que se envía (`GraphicsPipelineHost.tsx:343`). Verificado el 2026-08-11.

  Lo que sí queda anotado es que la integración corre por `rAF` en el hilo principal mientras el
  worker dibuja por `setInterval` propio: dos relojes independientes alimentando el mismo frame.
  Es el mismo desacople que mide R9, en otro punto del pipeline.

### R8 — El worker de `dvd-screensaver` hace `fetch()` arbitrario 🟡

`dvd-screensaver.worker.ts:143`: si el valor del control SVG no empieza con `<`, se lo trata como
URL y se hace `fetch(trimmed)` sin allowlist de host, sin timeout y sin límite de tamaño. El valor
viene de un control de texto libre del panel (`dvd-screensaver-declarative-schema.ts:45-65`), o
sea de los settings del proyecto, que son datos persistidos y potencialmente compartidos.

Hoy el riesgo es acotado porque el worker corre en el origen de core y los settings son locales.
Deja de serlo en cuanto los proyectos se compartan vía cloud: un `.lux` de un tercero podría hacer
que el worker de otro usuario emita peticiones a un host arbitrario. La contención natural es una
CSP `connect-src` en core, no un parche acá.

Menor, del mismo archivo: el caché de bitmaps se indexa por el markup completo del SVG
(`:277-278`), sin normalizar ni acotar la longitud de la clave. Con `MAX_BITMAP_CACHE_SIZE = 32`
y markups grandes, el `Map` retiene los strings enteros.

### R9 — Cadencia de dibujo fija y desacoplada del display 🟡

Los 4 workers usan `setInterval`. `requestAnimationFrame` no existe en un worker, así que la
decisión es correcta en su premisa, pero el literal `16` de tres de los cuatro workers implica
~62.5 fps nominales, sin relación con la tasa de refresco real ni con la cadencia del compositor.
El propio `diagnostic-fps` lo muestra: **58.8 fps de render contra 31.0 actualizaciones de datos
por segundo**, con 33 ms de jitter (captura del 2026-08-11). No hay backpressure: si el compositor
no consume, el worker sigue produciendo bitmaps.

El commit `8915331` agregó ese renderer justamente para medir esto. La medición existe; la
conclusión todavía no se tomó.

### R10 — El contrato de worker está escrito a mano cuatro veces 🟡

`WorkerMessage`, `workerScope`, `WORKER_PROTOCOL_VERSION`, `clamp`, `hexToRgb` y el `switch` de
`onmessage` están duplicados en los 4 workers, con variaciones. Ejemplo concreto de divergencia:
`hexToRgb` devuelve `{r:1,g:1,b:1}` en `concentric.worker.ts:70` y `{r:0.05,...}` en
`dvd-screensaver.worker.ts:109` ante la misma entrada inválida.

Extraerlo choca con R2: sin build, un módulo compartido tendría que resolverse por URL relativa
del otro lado del proxy. Es deuda que sólo se puede saldar después de decidir el modelo de
distribución.

### R11 — Deriva de versiones 🟡

Ver el documento dedicado: [`2026-08-06-drift-versiones.md`](2026-08-06-drift-versiones.md).

## 6. Lo que sí está bien

Vale marcarlo, porque el informe es largo en problemas:

- **El aislamiento worker-only se cumple sin excepciones.** Ningún renderer importa React, ni
  toca el DOM, ni depende de core. El refactor de `7053745` quedó completo.
- **La clave canónica es consistente en los 4 renderers** y coincide entre catálogo, manifest y
  allowlist de core, en las 4 filas.
- **`vite.config.ts` está bien resuelto**: `strictPort` en 4174 es lo que hace que el proxy de
  core sea determinista, y las cabeceras CORS son correctas y mínimas.
- **El comentario de las dos relojes en `diagnostic-fps.worker.ts:23-30`** documenta un error real
  y no obvio (`timeOrigin` del worker vs. del hilo principal) en el lugar donde importa. Es el
  mejor comentario del repo.
- **El repo clona y valida suelto**: sólo baja contracts de npm. Verificado en la Fase 1.

## 7. Preguntas abiertas para el autor

1. **¿`concentric` se migra a `RendererControlSpec`, o `RendererControlSpec` se migra a
   `DeclarativeControlSchema`?** (R6) El comentario de `concentric` dice que ya se migró *hacia*
   el sistema declarativo, pero es el único con esa forma. ¿Cuál de las dos es la dirección
   correcta? Mientras no se defina, core tiene que mantener dos extractores.

2. **¿El bloque Glitch de `dvd-screensaver` es trabajo pendiente o se abandonó?** (R3) Hay tipos y
   defaults en core, schema publicado acá, y cero implementación. Si se abandonó, corresponde
   sacarlo del schema; si está pendiente, corresponde marcarlo. Hoy no está ninguna de las dos
   cosas.

3. **¿La orientación del bitmap entra al contrato de worker?** (R1) Un renderer de un tercero no
   tiene forma de saber que tiene que pre-espejar su Canvas2D. Hoy eso es conocimiento tácito que
   sólo está en una línea de `diagnostic-fps`.

4. **¿Qué es un renderer publicado?** (R2) Mientras la respuesta sea "un `.ts` servido por un dev
   server", no hay versionado real, ni integridad, ni forma de que un tercero publique nada.

5. **¿`catalog.json` se conecta o se borra?** (§ 4) Hoy es documentación que un script valida y
   nadie lee. Las dos salidas son razonables; la actual —mantenerlo sincronizado a mano con la
   allowlist de core— es la única que no lo es.
