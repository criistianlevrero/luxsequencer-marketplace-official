# DVD Screensaver Renderer

## Descripcion funcional

- El usuario define una lista de assets. Cada asset puede ser texto o un archivo SVG.
- La tipografia del texto es fija en esta primera etapa (no configurable por el usuario).
- Cada asset tiene los siguientes parametros configurables:
  - delay inicial (tiempo antes de aparecer en pantalla)
  - velocidad de movimiento
  - velocidad de rotacion
  - direccion de rotacion
  - direccion de movimiento
- El renderer dibuja todos los assets y los anima con movimiento lineal.
- Cuando un asset colisiona con otro o con los bordes de la pantalla, rebota sin fisicas complejas.
- El fondo es configurable.
- El renderer incluye efectos tipo glitch seleccionables:
  - aberracion cromatica
  - franjas horizontales con desplazamiento aleatorio
  - parpadeos con cambios en un canal de color (invertir rojos, azules o verdes)

## Descripcion tecnica

- El renderer sera un modulo independiente dentro de src/components/renderers/dvd-screensaver/.
- Entradas esperadas en settings (a definir en el plan):
  - lista de assets con sus parametros
  - configuracion de fondo
  - configuracion de efectos glitch
- Pipeline general:
  - Cargar assets (texto o SVG) y generar representaciones renderizables.
  - Inicializar estados por asset: posicion, velocidad, rotacion, delay.
  - En cada frame:
    - actualizar posiciones y rotaciones segun delta de tiempo
    - detectar colisiones asset-asset y asset-borde
    - invertir componentes de velocidad segun el eje de colision
    - renderizar fondo, assets y efectos glitch
- Colisiones:
  - Approximacion por bounding boxes para texto y SVG.
  - Rebote simple invirtiendo el signo de la velocidad en el eje afectado.
- Efectos glitch (primer etapa):
  - Aberracion cromatica: offset de canales RGB en render final.
  - Franjas horizontales: aplicar bandas con desplazamiento aleatorio por frame.
  - Parpadeo por canal: invertir un canal de color de forma intermitente.

## Plan de implementacion (basado en la guia de renderers)

1) Estructura y registro
- Crear carpeta dedicada en `src/components/renderers/dvd-screensaver/`.
- Implementar componente `DVDScreensaverRenderer.tsx`.
- Implementar esquema de controles en `dvd-screensaver-schema.ts` (legacy y/o declarativo).
- Exportar `RendererDefinition` desde `index.ts`.
- Registrar el renderer en `src/components/renderers/index.ts` usando la clave `renderer.id`.
- Resultado testeable: el renderer aparece en el selector y puede activarse sin errores.

2) Defaults y settings
- Agregar defaults de settings en `public/default-project.json` y `default-project.json`.
- Usar rutas jerarquicas `renderer.dvd-screensaver.<propiedad>` y `common.<propiedad>`.
- Definir estructura de assets (texto y SVG) y parametros por asset.
- Resultado testeable: al recargar, el renderer mantiene defaults coherentes y no hay valores `undefined` en controles.

3) Implementacion WEBGL
- Usar un canvas WebGL dentro del renderer.
- Cargar assets y generar texturas (texto y SVG) en un atlas o texturas individuales.
- Renderizar cada asset como un quad con transformaciones 2D (posicion, escala, rotacion).
- Aplicar un shader de postprocesado para efectos glitch sobre el framebuffer final.
- Resultado testeable: se ve al menos un asset renderizado en pantalla y el canvas WebGL no muestra errores en consola.

4) Logica de animacion
- Mantener estado por asset: posicion, velocidad, rotacion, delay, dimensiones.
- Actualizar por frame con delta de tiempo.
- Implementar rebotes con limites de pantalla y colisiones asset-asset.
- Usar bounding boxes para colisiones; invertir el eje de velocidad correspondiente.
- Resultado testeable: el asset rebota contra bordes visibles y dos assets rebotan entre si de forma consistente.

5) Efectos glitch (primera etapa)
- Aberracion cromatica: offset de canales RGB en el shader de postprocesado.
- Franjas horizontales: aplicar offset o mascara por bandas aleatorias.
- Parpadeo por canal: invertir un canal con probabilidad o patron temporal.
- Resultado testeable: cada efecto puede activarse/desactivarse y su impacto visual es evidente en pantalla.

## Propuesta de settings iniciales

Rutas base:
- `renderer.dvd-screensaver.assets`
- `renderer.dvd-screensaver.background`
- `renderer.dvd-screensaver.glitch`

Estructura sugerida:

```ts
renderer: {
  'dvd-screensaver': {
    assets: [
      {
        id: 'asset-1',
        type: 'text', // 'text' | 'svg'
        text: 'DVD',
        svg: '',
        delayMs: 0,
        speed: 120,
        rotationSpeed: 20,
        rotationDirection: 1, // 1 o -1
        direction: 45, // grados, 0 = derecha
        scale: 1,
        opacity: 1
      }
    ],
    background: {
      color: '#0b0b0b',
      gradient: [] // reuse common background pattern si se integra
    },
    glitch: {
      chromaticAberration: {
        enabled: false,
        amount: 2
      },
      horizontalBands: {
        enabled: false,
        intensity: 0.5,
        bandCount: 6,
        speed: 0.6
      },
      channelFlicker: {
        enabled: false,
        probability: 0.1,
        channel: 'r' // 'r' | 'g' | 'b'
      }
    }
  }
}
```

## Detalle de implementacion WEBGL

- Pipeline recomendado:
  - Render target 1: dibujar fondo y quads de assets.
  - Render target 2 (postprocesado): aplicar shader glitch y presentar en pantalla.
- Texturas de texto:
  - Generar texto en canvas 2D y subirlo como textura WebGL.
  - Mantener cache por string para evitar regenerar por frame.
- Texturas de SVG:
  - Cargar SVG, rasterizar a canvas 2D y subir como textura.
  - Usar resolucion base configurable para balance calidad/performance.
- Coordenadas y transformaciones:
  - Calcular matriz 2D por asset (traslacion + rotacion).
  - Enviar posiciones y UVs a un shader simple de sprites.
- Colisiones y limites:
  - Usar dimensiones del quad en espacio de pantalla.
  - Rebote simple invirtiendo componentes de velocidad.
- Rendimiento:
  - Evitar recrear buffers por frame.
  - Minimizar cambios de textura agrupando renders por atlas si es posible.
