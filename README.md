# LuxSequencer Core Renderers Repository (Beta)

Repositorio inicial para publicar el pack oficial de renderers del marketplace.

## Orquestación del Proyecto

Este repositorio es parte de la arquitectura de LuxSequencer, compuesta por cuatro repositorios principales:

- **luxsequencer-core**: Aplicación principal de visualización generativa.
- **core-renderers** (este repo): Renderers oficiales y catálogo.
- **lux-ui**: Librería de componentes UI reutilizables.
- **luxsequencer-cloud**: Plataforma de gestión, marketplace y autenticación.

### Estructura de los repositorios

```
luxsequencer-core/
core-renderers/
lux-ui/
luxsequencer-cloud/
```

### Instalación y desarrollo

1. Clona los cuatro repositorios en la misma carpeta raíz.
2. Instala dependencias en cada uno:
   ```bash
   cd lux-ui && npm install
   cd ../core-renderers && npm install
   cd ../luxsequencer-core && npm install
   cd ../luxsequencer-cloud && npm install
   ```
3. Enlaza localmente la librería UI en los proyectos que la consumen:
   ```bash
   cd lux-ui
   npm run build # o npm link
   cd ../luxsequencer-core
   npm link lux-ui # o usa path local en package.json
   cd ../luxsequencer-cloud
   npm link lux-ui # si aplica
   ```
4. Orden recomendado para levantar todo:
   - Primero, inicia el marketplace de renderers:
     ```bash
     cd core-renderers
     npm run dev
     ```
   - Luego, inicia la app core:
     ```bash
     cd ../luxsequencer-core
     npm run dev
     # o npm run dev:all para levantar core + marketplace
     ```
   - Finalmente, inicia la plataforma cloud si la necesitas:
     ```bash
     cd ../luxsequencer-cloud
     npm run dev
     ```

> El core consume los workers de renderers vía proxy same-origin en desarrollo.

---
## Estructura

- `src/catalog.json`: catálogo del repo con herramientas publicadas.
- `src/renderers/*/manifest.json`: manifest por renderer/tool.
- `src/renderers/*/*.worker.ts`: implementación de runtime worker-only por renderer.

No se incluyen componentes React de UI dentro de este repositorio; el runtime oficial es `workerEntry` + `manifest`.

## Clave canónica de herramienta

Formato:

`publisherId/repositoryId:toolKind/toolId@major`

Ejemplos en este repo:

- `luxsequencer/core-renderers:renderer/webgl@1`
- `luxsequencer/core-renderers:renderer/concentric@1`
- `luxsequencer/core-renderers:renderer/dvd-screensaver@1`

## Integración en la app

Actualmente, la core app mantiene una allowlist hardcodeada de renderers permitidos y valida su clave canónica (`publisher/repository:kind/tool@major`) antes de cargarlos.

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

En desarrollo, la core app consume workers desde una ruta proxy same-origin (`/marketplace-core-renderers/...`) para evitar bloqueos de seguridad del constructor `Worker` entre distintos puertos/orígenes.

> Nota: este repo publica los workers fuente (`*.worker.ts`) y la core app resuelve su carga en runtime mediante su configuración/proxy de desarrollo.

## Plan de contratos compartidos (core + cloud + marketplace)

### Estado actual

- `core-renderers` ya consume contratos compartidos desde `@luxsequencer/contracts` (dependencia local `file:../luxsequencer-contracts`).
- `luxsequencer-core` mantiene su definición en `src/types/declarativeControls.ts`.
- `luxsequencer-cloud` necesitará los mismos contratos para intercambio API y validación de payloads.
- Se inicializó el repositorio `../luxsequencer-contracts` con estructura base (`declarativeControls`, `marketplace`, `api`) como punto de migración.

### Objetivo

Consolidar los tipos de dominio y contratos de integración en un paquete/repo dedicado (sugerido: `luxsequencer-contracts` o `@luxsequencer/contracts`) consumido por:

- `luxsequencer-core`
- `core-renderers`
- `luxsequencer-cloud`

### Fases propuestas

1. **Extracción mínima de contratos**
  - Mover tipos compartidos puros (schemas declarativos, manifests, catálogo, claves canónicas, payloads API) al nuevo repo.
  - Evitar cualquier dependencia hacia estado/UI internos de cada app.

2. **Versionado y compatibilidad**
  - Publicar paquete versionado semánticamente (`0.x` beta, luego `1.x`).
  - Definir política de compatibilidad de contratos entre apps (matriz de versiones soportadas).

3. **Migración de consumidores**
  - Reemplazar imports locales en `core`, `cloud` y `core-renderers` por imports del paquete compartido.
  - Mantener adapters temporales donde haya diferencias de shape.

4. **Validación runtime**
  - Agregar validadores runtime en `core` y `cloud` (ej. JSON Schema o Zod) usando los mismos contratos para robustez en datos remotos.

### Criterio de éxito

- Una sola fuente de verdad para contratos compartidos.
- Cero imports cruzados por path relativo entre repos.
- `core`, `cloud` y `core-renderers` compilan/validan contra la misma versión de contratos.
