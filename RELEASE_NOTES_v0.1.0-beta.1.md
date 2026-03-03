# Release Notes — v0.1.0-beta.1

Fecha: 2026-03-03  
Repositorio: `criistianlevrero/luxsequencer-marketplace-official`

## Resumen

Primer release beta del paquete marketplace `core-renderers`, con catálogo inicial de herramientas visuales y contratos base para integración con LuxSequencer.

## Incluye

- Estructura inicial del paquete marketplace (`src`, `scripts`, `README`, `package.json`).
- Catálogo inicial en `src/catalog.json`.
- Manifests y workers para renderers base:
  - `webgl-scale`
  - `concentric`
  - `dvd-screensaver`
- Shared schema para textura/escala y utilidades asociadas.
- Script de validación de catálogo (`scripts/validate-catalog.mjs`).

## Alcance de esta beta

- Release orientado a validación técnica de integración marketplace.
- Contratos e identidad canónica en modo estricto v1.
- Sin compromiso de compatibilidad retroactiva durante etapa beta.

## Verificación rápida

```bash
npm install
npm run validate:catalog
```

## Commit asociado

- `5c0dba1` — `feat(repo): initial core renderers marketplace package`

## Tag

- `v0.1.0-beta.1`

## Notas

Si publicas GitHub Release, puedes usar este documento como body y mantener el mismo tag.
