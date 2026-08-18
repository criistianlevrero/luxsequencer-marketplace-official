> **Estado**: PARCIAL · **Fecha original**: sin fechar · **Última verificación**: 2026-08-18
>
> Vivía dentro del `README.md` de este repo, presentado como plan a futuro. Movido acá el
> 2026-08-18, al recortar el README, y **reverificado**: las fases 1 y 2 están hechas y la 3 está
> casi completa. Sólo la fase 4 sigue siendo trabajo planeado.

# Plan de contratos compartidos (core + cloud + marketplace)

## Objetivo

Consolidar los tipos de dominio y contratos de integración en un paquete dedicado,
`@luxsequencer/contracts`, consumido por `luxsequencer-core`, `core-renderers` y
`luxsequencer-cloud`.

## Estado por fase, verificado el 2026-08-18

| Fase | Estado | Evidencia |
|---|---|---|
| 1. Extracción mínima de contratos | ✅ **hecha** | El repo `luxsequencer-contracts` existe con `declarativeControls`, `marketplace` y `api` |
| 2. Versionado y compatibilidad | 🟡 **parcial** | Publicado como `@luxsequencer/contracts@0.1.0` en npm público (MIT) el 2026-08-06. Falta la matriz de versiones soportadas |
| 3. Migración de consumidores | 🟡 **casi** | `core-renderers` y `luxsequencer-cloud` consumen `^0.1.0`. `luxsequencer-core` también, pero **conserva `src/types/declarativeControls.ts`** |
| 4. Validación runtime | ⬜ **planeada** | `zod` no está instalado ni en `core` ni en `core-renderers`. `luxsequencer-cloud` sí lo usa, pero para sus payloads de API, no para contratos compartidos |

## Lo que queda

### Fase 2 — política de compatibilidad

Falta definir la matriz de versiones soportadas entre apps. Hay una trampa ya documentada que
hace esto más urgente de lo que parece: **el caret en `0.x` es restrictivo**. `^0.1.0` es
`>=0.1.0 <0.2.0`, así que al subir `@luxsequencer/contracts` a `0.2.0` npm deja de enlazar la
carpeta local y baja la `0.1.0` del registro **en silencio**. Al bumpear una minor hay que
actualizar los rangos de los consumidores en el mismo commit.

### Fase 3 — el resto de la migración de core

`luxsequencer-core` mantiene `src/types/declarativeControls.ts`. Hay que verificar si es un
adaptador local legítimo —el propio README de core admite `src/types/*` para adaptadores de
UI/estado— o una duplicación del contrato compartido que quedó sin migrar. Ese es el criterio que
decide si la fase 3 se cierra o no.

### Fase 4 — validación runtime

Agregar validadores runtime en `core` usando los mismos contratos, para robustez ante datos
remotos. Es la única fase que sigue siendo trabajo nuevo de punta a punta.

## Criterio de éxito

- Una sola fuente de verdad para contratos compartidos.
- Cero imports cruzados por path relativo entre repos. **Ya se cumple**: la migración a workspace
  del 2026-08-06 reemplazó las dependencias `file:../` por rangos semver.
- `core`, `cloud` y `core-renderers` compilan/validan contra la misma versión de contratos.
