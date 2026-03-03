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

La app puede cargar este repo desde el árbol de `localStorage` en la clave:

- `luxsequencer.marketplace.tree.v1`

Cada tool debe incluir su `packageManifest` v1, `workerEntry` y metadatos de acceso.

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

> Nota: este paso habilita la capa HTTP del repositorio marketplace. La publicación de workers transpilados y su resolución final desde la core app se realiza en el siguiente paso de integración runtime.
