> **Estado**: VIGENTE · **Fecha**: 2026-08-06 · **Última verificación**: 2026-08-11

# Versiones inconsistentes en `core-renderers`

Hallazgo de la auditoría de Fase 1 (2026-08-06), mudado desde
`docs/auditoria/2026-08-06-drift-por-proyecto.md` de la raíz el 2026-08-11 y **reverificado** en
la sesión de Fase 2 de este repo.

## El hallazgo original (2026-08-06)

> Existe `RELEASE_NOTES_v0.1.0-beta.2.md`, pero `package.json` y `catalog.json` siguen en
> `0.1.0-beta.1`. Y los `manifest.json` de los renderers declaran `packageVersion: "0.6.0-beta"`
> —la versión de *core*, no la del repo de renderers.

## Reverificación (2026-08-11, `main` en `e2ac2ce`)

Sigue vigente, y con más distancia acumulada.

| Fuente | Versión declarada | Archivo |
|---|---|---|
| Paquete | `0.1.0-beta.1` | `package.json:3` |
| Catálogo | `0.1.0-beta.1` | `src/catalog.json:4` |
| Manifest de `webgl` | `0.6.0-beta` | `src/renderers/webgl/manifest.json` |
| Manifest de `concentric` | `0.6.0-beta` | `src/renderers/concentric/manifest.json` |
| Manifest de `dvd-screensaver` | `0.6.0-beta` | `src/renderers/dvd-screensaver/manifest.json` |
| Manifest de `diagnostic-fps` | `0.6.0-beta` | `src/renderers/diagnostic-fps/manifest.json` |
| Tag de git más alto | `v0.1.0-beta.2` | `git tag -l` |
| `luxsequencer-core` | `0.6-beta` | `luxsequencer-core/package.json:4` |

Tres numeraciones distintas conviviendo:

1. **`package.json` y `catalog.json` quedaron en `0.1.0-beta.1`** aunque el tag `v0.1.0-beta.2`
   existe. Es decir: se etiquetó una release sin subir la versión del paquete.

2. **HEAD está 6 commits por delante de `v0.1.0-beta.2`**, y esos 6 commits **no** son cosméticos.
   Incluyen el refactor a worker-only (`7053745`), el pasaje de contracts a npm (`f32c944`), un
   renderer nuevo entero (`8915331`) y dos arreglos. Nada de eso subió ningún número.

3. **`packageVersion: "0.6.0-beta"` en los manifests es la versión de core**, con un `.0` extra
   respecto de `0.6-beta`. No se corresponde con ninguna versión de este repo, ni siquiera con
   una que haya existido.

## Por qué importa más de lo que parece

El `packageVersion` del manifest no es cosmético: es el campo que un consumidor usaría para
decidir compatibilidad. Hoy declara la versión de la aplicación que lo consume, lo cual invierte
la dirección de la dependencia. Cualquier verificación de compatibilidad basada en ese campo
compara contra el dato equivocado.

Está agravado porque **nadie lee los manifests**: core tiene copias literales dentro de su
allowlist (`luxsequencer-core/src/components/renderers/index.ts:154-238`), con el mismo
`0.6.0-beta` copiado a mano cuatro veces. El error no se detecta porque el campo no se usa; y el
día que se use, va a estar mal en dos lugares a la vez.

Ver el § 4 de la [auditoría de Fase 2](2026-08-11-fase-2-core-renderers.md) para el detalle de la
desconexión entre catálogo, manifests y allowlist.

## No resuelto

Este documento registra el hallazgo; no lo arregla. Decidir el esquema de versionado de este repo
depende de resolver antes qué es una release acá, que es la pregunta 4 de la auditoría de Fase 2
y parte de
[`docs/next-steps/bloqueantes-modelo-distribucion.md`](../../../docs/next-steps/bloqueantes-modelo-distribucion.md)
de la raíz.
