import type { DeclarativeControlSchema } from '@luxsequencer/contracts/declarative-controls';

/**
 * CONCENTRIC RENDERER - DECLARATIVE CONTROL SCHEMA
 * Comprehensive declarative control specification for the concentric renderer.
 * Migrated from legacy schema system to new declarative architecture.
 */

// === PRESETS DEFINITION ===
const CONCENTRIC_PRESETS = [
  {
    id: 'concentric-default',
    name: 'Default Concentric',
    settings: {
      repetitionSpeed: 1.0,
      growthSpeed: 1.5,
      initialSize: 20,
      rotationSpeed: 0,
      strokeWidth: 2,
      fillMode: 'stroke',
      sides: 6,
      gradientColors: [
        { color: '#00ffff', hardStop: false },
        { color: '#ff00ff', hardStop: false },
        { color: '#ffff00', hardStop: false }
      ],
      animationSpeed: 1.0,
      animationDirection: 0,
      backgroundGradientColors: [
        { color: '#000000', hardStop: false }
      ]
    }
  },
  {
    id: 'concentric-fast',
    name: 'Fast Ripples',
    settings: {
      repetitionSpeed: 2.5,
      growthSpeed: 3.0,
      initialSize: 10,
      rotationSpeed: 0,
      strokeWidth: 2,
      fillMode: 'stroke',
      sides: 6,
      gradientColors: [
        { color: '#FF6B6B', hardStop: false },
        { color: '#4ECDC4', hardStop: false },
        { color: '#45B7D1', hardStop: false }
      ],
      animationSpeed: 2.0,
      animationDirection: 90,
      backgroundGradientColors: [
        { color: '#1A1A1A', hardStop: false }
      ]
    }
  },
  {
    id: 'concentric-slow',
    name: 'Slow Waves',
    settings: {
      repetitionSpeed: 0.5,
      growthSpeed: 0.8,
      initialSize: 50,
      rotationSpeed: 0,
      strokeWidth: 2,
      fillMode: 'stroke',
      sides: 6,
      gradientColors: [
        { color: '#8E44AD', hardStop: true },
        { color: '#3498DB', hardStop: true },
        { color: '#E74C3C', hardStop: true }
      ],
      animationSpeed: 0.5,
      animationDirection: 180,
      backgroundGradientColors: [
        { color: '#2C3E50', hardStop: false },
        { color: '#34495E', hardStop: false }
      ]
    }
  },
  {
    id: 'concentric-minimal',
    name: 'Minimal Rings',
    settings: {
      repetitionSpeed: 1.2,
      growthSpeed: 1.0,
      initialSize: 30,
      rotationSpeed: 0,
      strokeWidth: 2,
      fillMode: 'stroke',
      sides: 6,
      gradientColors: [
        { color: '#FFFFFF', hardStop: false },
        { color: '#ECF0F1', hardStop: false }
      ],
      animationSpeed: 0.8,
      animationDirection: 45,
      backgroundGradientColors: [
        { color: '#2C3E50', hardStop: false }
      ]
    }
  }
];

// === MAIN SCHEMA DEFINITION ===
export const concentricDeclarativeSchema: DeclarativeControlSchema = {
  schemaVersion: '1.0.0',
  rendererId: 'concentric',
  rendererName: 'Concentric Renderer',
  description: 'Hexagonal concentric pattern generator with ripple animations and multi-layer gradients',
  
  presets: CONCENTRIC_PRESETS,
  
  sections: [
    // === CONCENTRIC GEOMETRY SECTION ===
    {
      id: 'concentric-geometry',
      title: 'Ring Geometry',
      description: 'Configure the size, speed, and growth patterns of concentric rings',
      defaultOpen: true,
      controls: [
        {
          type: 'slider',
          id: 'repetitionSpeed',
          label: 'Ring Generation Speed',
          description: 'Controls how fast new rings are generated from the center',
          min: 0.1,
          max: 5.0,
          step: 0.1,
          defaultValue: 1.0,
          formatter: (value: number) => value != null ? `${value.toFixed(1)}Hz` : '0.0Hz',
          valueLabels: {
            0.1: 'Very Slow',
            1.0: 'Normal',
            2.5: 'Fast',
            5.0: 'Very Fast'
          }
        },
        {
          type: 'slider',
          id: 'growthSpeed',
          label: 'Ring Expansion Speed',
          description: 'Controls how fast rings expand outward from center',
          min: 0.1,
          max: 5.0,
          step: 0.1,
          defaultValue: 1.5,
          formatter: (value: number) => value != null ? `${value.toFixed(1)}x` : '0.0x',
          valueLabels: {
            0.1: 'Crawling',
            0.5: 'Slow',
            1.0: 'Normal',
            2.0: 'Fast',
            5.0: 'Lightning'
          }
        },
        {
          type: 'slider',
          id: 'initialSize',
          label: 'Initial Ring Size',
          description: 'Size of rings when they first appear at the center',
          min: 1,
          max: 100,
          step: 1,
          defaultValue: 20,
          formatter: (value: number) => value != null ? `${value}px` : '0px'
        },
        {
          type: 'slider',
          id: 'rotationSpeed',
          label: 'Rotation Speed',
          description: 'Rotation speed for the concentric polygon in degrees per second',
          min: -180,
          max: 180,
          step: 1,
          defaultValue: 0,
          formatter: (value: number) => value != null ? `${Math.round(value)}°/s` : '0°/s'
        },
        {
          type: 'slider',
          id: 'strokeWidth',
          label: 'Stroke Width',
          description: 'Line width of the concentric polygon stroke',
          min: 0.5,
          max: 10,
          step: 0.5,
          defaultValue: 2,
          formatter: (value: number) => value != null ? `${value.toFixed(1)}px` : '2.0px'
        },
        {
          type: 'select',
          id: 'fillMode',
          label: 'Fill Mode',
          description: 'Whether rings are stroked, filled, or both',
          constraints: {
            select: {
              options: [
                { value: 'stroke', label: 'Stroke' },
                { value: 'fill', label: 'Fill' },
                { value: 'both', label: 'Both' }
              ]
            }
          },
          defaultValue: 'stroke'
        },
        {
          type: 'slider',
          id: 'sides',
          label: 'Shape Sides',
          description: 'Number of sides for the concentric polygon (3-12)',
          min: 3,
          max: 12,
          step: 1,
          defaultValue: 6,
          formatter: (value: number) => value != null ? `${Math.round(value)}` : '6'
        }
      ]
    },

    // === RING COLORS SECTION ===
    {
      id: 'concentric-colors',
      title: 'Ring Colors',
      description: 'Configure gradient colors that flow through the concentric rings',
      defaultOpen: true,
      controls: [
        {
          type: 'gradient',
          id: 'gradientColors',
          label: 'Ring Gradient',
          description: 'Colors that cycle through the concentric rings as they expand',
          defaultValue: [
            { color: '#00ffff', hardStop: false },
            { color: '#ff00ff', hardStop: false },
            { color: '#ffff00', hardStop: false }
          ],
          maxColors: 8,
          minColors: 2,
          supportsHardStops: true
        }
      ]
    },

    // === BACKGROUND SECTION ===
    {
      id: 'concentric-background',
      title: 'Background',
      description: 'Configure background colors and gradients',
      defaultOpen: false,
      controls: [
        {
          type: 'gradient',
          id: 'backgroundGradientColors',
          label: 'Background Gradient',
          description: 'Background gradient colors behind the rings',
          defaultValue: [
            { color: '#000000', hardStop: false }
          ],
          maxColors: 10,
          supportsHardStops: true
        }
      ]
    },

    // === ANIMATION SECTION ===
    {
      id: 'concentric-animation',
      title: 'Global Animation',
      description: 'Control global animation speed and direction for ring patterns',
      defaultOpen: false,
      controls: [
        {
          type: 'slider',
          id: 'animationSpeed',
          label: 'Global Animation Speed',
          description: 'Overall speed multiplier for all ring animations',
          min: 0.0,
          max: 5.0,
          step: 0.1,
          defaultValue: 1.0,
          formatter: (value: number) => value == null ? 'Paused' : (value === 0 ? 'Paused' : `${value.toFixed(1)}x`)
        },
        {
          type: 'slider',
          id: 'animationDirection',
          label: 'Pattern Direction',
          description: 'Direction angle for pattern flow across the canvas',
          min: 0,
          max: 360,
          step: 15,
          defaultValue: 0,
          formatter: (value: number) => value != null ? `${value}°` : '0°',
          valueLabels: {
            0: 'Right →',
            45: 'Down-Right ↘',
            90: 'Down ↓',
            135: 'Down-Left ↙',
            180: 'Left ←',
            225: 'Up-Left ↖',
            270: 'Up ↑',
            315: 'Up-Right ↗',
            360: 'Right →'
          }
        }
      ]
    }
  ],

  // === VALIDATION RULES ===
  validation: [
    {
      property: 'repetitionSpeed',
      rules: [
        {
          type: 'range',
          min: 0.1,
          max: 5.0,
          message: 'Ring generation speed must be between 0.1 and 5.0 Hz'
        }
      ]
    },
    {
      property: 'growthSpeed',
      rules: [
        {
          type: 'range',
          min: 0.1,
          max: 5.0,
          message: 'Ring expansion speed must be between 0.1 and 5.0x'
        }
      ]
    },
    {
      property: 'gradientColors',
      rules: [
        {
          type: 'custom',
          validator: (value: any) => Array.isArray(value) && value.length >= 2 && value.length <= 8,
          message: 'Ring gradient must have between 2 and 8 colors'
        }
      ]
    },
    {
      property: 'initialSize',
      rules: [
        {
          type: 'range',
          min: 1,
          max: 100,
          message: 'Initial ring size must be between 1 and 100 pixels'
        }
      ]
    },
    {
      property: 'rotationSpeed',
      rules: [
        {
          type: 'range',
          min: -180,
          max: 180,
          message: 'Rotation speed must be between -180 and 180 degrees per second'
        }
      ]
    },
    {
      property: 'strokeWidth',
      rules: [
        {
          type: 'range',
          min: 0.5,
          max: 10,
          message: 'Stroke width must be between 0.5 and 10 pixels'
        }
      ]
    },
    {
      property: 'fillMode',
      rules: [
        {
          type: 'custom',
          validator: (value: any) => ['stroke', 'fill', 'both'].includes(value),
          message: 'Fill mode must be stroke, fill, or both'
        }
      ]
    },
    {
      property: 'sides',
      rules: [
        {
          type: 'range',
          min: 3,
          max: 12,
          message: 'Shape sides must be between 3 and 12'
        }
      ]
    }
  ],

  // === METADATA ===
  metadata: {
    version: '1.0.0',
    author: 'LuxSequencer',
    created: '2024-01-26',
    lastModified: '2024-01-26',
    tags: ['concentric', 'ripples', 'hexagonal', 'gradient', 'rings', 'animated'],
    performance: {
      complexity: 'low',
      gpuIntensive: false,
      recommendedMaxInstances: 2
    },
    features: [
      'Concentric hexagonal rings',
      'Configurable generation and expansion speeds',
      'Multi-color gradient cycling',
      'Ring size and timing control',
      'Background gradient support',
      'Real-time parameter updates',
      'Smooth animation curves',
      'Low GPU requirements'
    ],
    requirements: {
      webgl: 'none',
      shaderModel: 'none',
      extensions: []
    }
  }
};

export default concentricDeclarativeSchema;