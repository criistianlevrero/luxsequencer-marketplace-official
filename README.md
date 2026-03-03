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
