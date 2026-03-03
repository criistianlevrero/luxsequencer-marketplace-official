import type { RendererControlSpec } from '../../../types/declarativeControls';

const DependencyConditions = {
  equals: (expectedValue: unknown) => (value: unknown) => value === expectedValue,
};

export const dvdScreensaverDeclarativeSchema: RendererControlSpec = {
  standard: [
    {
      id: 'renderer.dvd-screensaver.assets.0.type',
      type: 'select',
      category: 'Asset 1',
      label: 'Tipo',
      constraints: {
        select: {
          options: [
            { value: 'text', label: 'Texto' },
            { value: 'svg', label: 'SVG' }
          ]
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.text',
      type: 'text',
      category: 'Asset 1',
      label: 'Texto',
      constraints: {
        text: {
          placeholder: 'Escribe el texto',
          maxLength: 64
        }
      },
      metadata: {
        dependencies: [
          {
            property: 'renderer.dvd-screensaver.assets.0.type',
            condition: DependencyConditions.equals('text'),
            effect: 'show'
          }
        ]
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.svg',
      type: 'text',
      category: 'Asset 1',
      label: 'SVG (URL o markup)',
      constraints: {
        text: {
          placeholder: '<svg ...>...</svg> o https://.../file.svg',
          multiline: true,
          rows: 4
        }
      },
      metadata: {
        dependencies: [
          {
            property: 'renderer.dvd-screensaver.assets.0.type',
            condition: DependencyConditions.equals('svg'),
            effect: 'show'
          }
        ]
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.speed',
      type: 'slider',
      category: 'Movimiento',
      label: 'Velocidad',
      constraints: {
        slider: {
          min: 10,
          max: 400,
          step: 5,
          formatter: (value) => `${Math.round(value)} px/s`
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.direction',
      type: 'slider',
      category: 'Movimiento',
      label: 'Direccion',
      constraints: {
        slider: {
          min: 0,
          max: 360,
          step: 1,
          formatter: (value) => `${Math.round(value)} deg`
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.rotationSpeed',
      type: 'slider',
      category: 'Movimiento',
      label: 'Velocidad de rotacion',
      constraints: {
        slider: {
          min: 0,
          max: 180,
          step: 1,
          formatter: (value) => `${Math.round(value)} deg/s`
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.rotationDirection',
      type: 'select',
      category: 'Movimiento',
      label: 'Direccion de rotacion',
      constraints: {
        select: {
          options: [
            { value: 1, label: 'Horario' },
            { value: -1, label: 'Anti horario' }
          ]
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.delayMs',
      type: 'slider',
      category: 'Movimiento',
      label: 'Delay inicial',
      constraints: {
        slider: {
          min: 0,
          max: 5000,
          step: 50,
          formatter: (value) => `${Math.round(value)} ms`
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.scale',
      type: 'slider',
      category: 'Apariencia',
      label: 'Escala',
      constraints: {
        slider: {
          min: 0.2,
          max: 3,
          step: 0.05,
          formatter: (value) => `${value.toFixed(2)}x`
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.assets.0.opacity',
      type: 'slider',
      category: 'Apariencia',
      label: 'Opacidad',
      constraints: {
        slider: {
          min: 0.1,
          max: 1,
          step: 0.05,
          formatter: (value) => `${Math.round(value * 100)}%`
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.globalSpeed',
      type: 'slider',
      category: 'Global',
      label: 'Global speed',
      constraints: {
        slider: {
          min: 0.1,
          max: 3,
          step: 0.1,
          formatter: (value) => `${value.toFixed(1)}x`
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.globalRotationSpeed',
      type: 'slider',
      category: 'Global',
      label: 'Global rotation speed',
      constraints: {
        slider: {
          min: 0,
          max: 3,
          step: 0.1,
          formatter: (value) => `${value.toFixed(1)}x`
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.background.color',
      type: 'text',
      category: 'Fondo',
      label: 'Color de fondo',
      constraints: {
        text: {
          placeholder: '#000000 o rgba(0,0,0,0.5)',
          maxLength: 50
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.chromaticAberration.enabled',
      type: 'select',
      category: 'Glitch',
      label: 'Aberración cromática',
      constraints: {
        select: {
          options: [
            { value: true, label: 'Activo' },
            { value: false, label: 'Inactivo' }
          ]
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.chromaticAberration.amount',
      type: 'slider',
      category: 'Glitch',
      label: 'Intensidad cromática',
      constraints: {
        slider: {
          min: 0.5,
          max: 10,
          step: 0.5,
          formatter: (value) => `${value.toFixed(1)}px`
        }
      },
      metadata: {
        dependencies: [
          {
            property: 'renderer.dvd-screensaver.glitch.chromaticAberration.enabled',
            condition: DependencyConditions.equals(true),
            effect: 'show'
          }
        ]
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.horizontalBands.enabled',
      type: 'select',
      category: 'Glitch',
      label: 'Bandas horizontales',
      constraints: {
        select: {
          options: [
            { value: true, label: 'Activo' },
            { value: false, label: 'Inactivo' }
          ]
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.horizontalBands.intensity',
      type: 'slider',
      category: 'Glitch',
      label: 'Intensidad de bandas',
      constraints: {
        slider: {
          min: 0,
          max: 1,
          step: 0.05,
          formatter: (value) => `${Math.round(value * 100)}%`
        }
      },
      metadata: {
        dependencies: [
          {
            property: 'renderer.dvd-screensaver.glitch.horizontalBands.enabled',
            condition: DependencyConditions.equals(true),
            effect: 'show'
          }
        ]
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.horizontalBands.bandCount',
      type: 'slider',
      category: 'Glitch',
      label: 'Número de bandas',
      constraints: {
        slider: {
          min: 2,
          max: 20,
          step: 1,
          formatter: (value) => `${Math.round(value)}`
        }
      },
      metadata: {
        dependencies: [
          {
            property: 'renderer.dvd-screensaver.glitch.horizontalBands.enabled',
            condition: DependencyConditions.equals(true),
            effect: 'show'
          }
        ]
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.horizontalBands.speed',
      type: 'slider',
      category: 'Glitch',
      label: 'Velocidad de bandas',
      constraints: {
        slider: {
          min: 0.1,
          max: 5,
          step: 0.1,
          formatter: (value) => `${value.toFixed(1)}x`
        }
      },
      metadata: {
        dependencies: [
          {
            property: 'renderer.dvd-screensaver.glitch.horizontalBands.enabled',
            condition: DependencyConditions.equals(true),
            effect: 'show'
          }
        ]
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.channelFlicker.enabled',
      type: 'select',
      category: 'Glitch',
      label: 'Parpadeo de canal',
      constraints: {
        select: {
          options: [
            { value: true, label: 'Activo' },
            { value: false, label: 'Inactivo' }
          ]
        }
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.channelFlicker.probability',
      type: 'slider',
      category: 'Glitch',
      label: 'Probabilidad de parpadeo',
      constraints: {
        slider: {
          min: 0,
          max: 1,
          step: 0.05,
          formatter: (value) => `${Math.round(value * 100)}%`
        }
      },
      metadata: {
        dependencies: [
          {
            property: 'renderer.dvd-screensaver.glitch.channelFlicker.enabled',
            condition: DependencyConditions.equals(true),
            effect: 'show'
          }
        ]
      }
    },
    {
      id: 'renderer.dvd-screensaver.glitch.channelFlicker.channel',
      type: 'select',
      category: 'Glitch',
      label: 'Canal de parpadeo',
      constraints: {
        select: {
          options: [
            { value: 'r', label: 'Rojo' },
            { value: 'g', label: 'Verde' },
            { value: 'b', label: 'Azul' }
          ]
        }
      },
      metadata: {
        dependencies: [
          {
            property: 'renderer.dvd-screensaver.glitch.channelFlicker.enabled',
            condition: DependencyConditions.equals(true),
            effect: 'show'
          }
        ]
      }
    }
  ]
};
