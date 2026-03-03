# LuxSequencer Core Renderers Repository (Beta)

Repositorio inicial para publicar el pack oficial de renderers del marketplace.

## Estructura

- `src/catalog.json`: catálogo del repo con herramientas publicadas.
- `src/renderers/*/manifest.json`: manifest por renderer/tool.

## Clave canónica de herramienta

Formato:

`publisherId/repositoryId:toolKind/toolId@major`

Ejemplos en este repo:

- `luxsequencer/core-renderers:renderer/webgl@1`
- `luxsequencer/core-renderers:renderer/concentric@1`
- `luxsequencer/core-renderers:renderer/dvd-screensaver@1`

## Integración en la app

Actualmente, la core app mantiene una lista hardcodeada de renderers permitidos y valida su clave canónica (`publisher/repository:kind/tool@major`) antes de cargarlos.

Cada tool debe incluir su `packageManifest` v1 y `runtime.workerEntry` válido.

## Servidor HTTP del marketplace (Vite + CORS)

Este repositorio puede exponerse como servidor HTTP para que la core app acceda a catálogo, manifests y assets.

Scripts:

- `npm run dev` → inicia servidor Vite en `http://localhost:4174`
- `npm run preview` → preview con misma configuración de CORS
- `npm run validate:catalog` → valida consistencia básica del catálogo

Configuración aplicada:

- CORS habilitado (`Access-Control-Allow-Origin: *`)
- `host: true` para acceso desde otras interfaces/red local
- puerto fijo `4174`

En desarrollo, la core app consume workers desde una ruta proxied same-origin (`/marketplace-core-renderers/...`) para evitar bloqueos de seguridad del constructor `Worker` entre distintos puertos/orígenes.

> Nota: este repo publica los workers fuente (`*.worker.ts`) y la core app resuelve su carga en runtime mediante su configuración/proxy de desarrollo.
