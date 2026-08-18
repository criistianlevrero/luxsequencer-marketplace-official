# LuxSequencer Core Renderers Repository (Beta)

Repositorio inicial para publicar el pack oficial de renderers del marketplace.

## Dónde encaja este repo

Este repositorio contiene **los renderers oficiales de LuxSequencer**, como workers, más su
catálogo y manifests. Es uno de los cinco proyectos del ecosistema, junto a `luxsequencer-core`,
`lux-ui`, `luxsequencer-contracts` y `luxsequencer-cloud`.

**La orquestación del ecosistema —topología, instalación, resolución de dependencias— vive en el
README del workspace, no acá.** Este repo se puede clonar suelto: su única dependencia es
`@luxsequencer/contracts`, que baja del registro npm.

### Cómo se levanta junto a la app core

`core-renderers` sirve los workers que la app core carga por proxy, así que **va primero**:

```bash
# 1. acá
npm run dev                          # puerto 4174, strictPort

# 2. en luxsequencer-core
npm run dev                          # puerto 3000, proxea el 4174
```

El atajo que hace las dos cosas es `npm run dev:all`, desde `luxsequencer-core`.

> **El 4174 devuelve 404 en `/` a propósito.** Este repo no tiene `index.html`: sólo sirve
> archivos bajo `/src/`. Ver un 404 ahí no significa que esté roto.

---
## Estructura

- `src/catalog.json`: catálogo del repo con herramientas publicadas.
- `src/renderers/*/manifest.json`: manifest por renderer/tool.
- `src/renderers/*/*.worker.ts`: implementación de runtime worker-only por renderer.

No se incluyen componentes React de UI dentro de este repositorio; el runtime oficial es `workerEntry` + `manifest`.

## Clave canónica de herramienta

Formato:

`publisherId/repositoryId:toolKind/toolId@major`

Los **cuatro** renderers publicados en `src/catalog.json`:

- `luxsequencer/core-renderers:renderer/webgl@1` — Escamas WebGL
- `luxsequencer/core-renderers:renderer/concentric@1` — Concéntrico
- `luxsequencer/core-renderers:renderer/dvd-screensaver@1` — DVD Screensaver
- `luxsequencer/core-renderers:renderer/diagnostic-fps@1` — Diagnóstico FPS/Data

## Integración en la app

Actualmente, la core app mantiene una allowlist hardcodeada de renderers permitidos y valida su clave canónica (`publisher/repository:kind/tool@major`) antes de cargarlos.

Cada tool debe incluir su `packageManifest` v1 y `runtime.workerEntry` válido.

## Servidor HTTP del marketplace (Vite + CORS)

Este repositorio puede exponerse como servidor HTTP para que la core app acceda a catálogo, manifests y assets.

Scripts:

- `npm run dev` → inicia servidor Vite en `http://localhost:4174`
- `npm run validate:catalog` → valida consistencia básica del catálogo
- `npm run preview` → **no sirve para nada hoy.** Arranca y devuelve 404 en todo, porque no hay
  build: este repo publica los `.ts` crudos para que Vite los transpile del lado del consumidor.
  Está declarado en `package.json` pero no tiene artefacto que servir.

Configuración aplicada:

- CORS habilitado (`Access-Control-Allow-Origin: *`)
- `host: true` para acceso desde otras interfaces/red local
- puerto fijo `4174`

En desarrollo, la core app consume workers desde una ruta proxy same-origin (`/marketplace-core-renderers/...`) para evitar bloqueos de seguridad del constructor `Worker` entre distintos puertos/orígenes.

> Nota: este repo publica los workers fuente (`*.worker.ts`) y la core app resuelve su carga en runtime mediante su configuración/proxy de desarrollo.

## Contratos compartidos

Este repo consume `@luxsequencer/contracts` (`^0.1.0`). Dentro del workspace npm enlaza la carpeta
local; clonando suelto, lo baja del registro.

El plan de consolidación de contratos entre los tres consumidores —con el estado real de cada una
de sus cuatro fases— vive en
[`docs/next-steps/contratos-compartidos.md`](docs/next-steps/contratos-compartidos.md). Estaba
acá, presentado como trabajo futuro, cuando las dos primeras fases ya estaban hechas.
