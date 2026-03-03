# DVD Screensaver (core-renderers)

Renderer oficial publicado por `core-renderers` y consumido por `luxsequencer-core` vía `workerEntry` remoto.

## Archivos del renderer

- `dvd-screensaver.worker.ts`: implementación worker-only del renderer.
- `dvd-screensaver-declarative-schema.ts`: esquema declarativo de controles.
- `DvdScreensaverRenderer.tsx`: placeholder sin lógica de render (el render real vive en el worker).
- `manifest.json`: identidad canónica y metadatos del tool.
- `index.ts`: definición exportada para registro en catálogo.

## Identidad canónica

- Tool key: `luxsequencer/core-renderers:renderer/dvd-screensaver@1`
- `publisherId`: `luxsequencer`
- `repositoryId`: `core-renderers`
- `tool.kind`: `renderer`
- `tool.id`: `dvd-screensaver`

## Contrato operativo

- El core resuelve este renderer por allowlist y valida identidad del manifest.
- El worker debe exponer capacidades compatibles con el protocolo activo (`offscreen-canvas`, `canvas2d`, `uniform-updates`).
- No se registran componentes React de UI para lógica de render en el core app.

## Notas

- Este README documenta únicamente el estado actual en `core-renderers`.
- La arquitectura global del sistema está en `luxsequencer-core/docs/renderers.md`.
