/**
 * WebGL renderer declarative control schema
 * Demonstrates advanced features of the declarative control system
 */

import type { RendererControlSpec, StandardControlSpec as _StandardControlSpec } from '../../../types/declarativeControls';
import { DependencyConditions, CommonDependencies as _CommonDependencies, createDependencies as _createDependencies } from '../../declarative/dependencyUtils';

/**
 * WebGL renderer control specification using declarative system
 */
export const webglRendererControlSpec: RendererControlSpec = {
  standard: [
    // === Scale Configuration ===
    {
      id: 'renderer.scales.scaleSize',
      type: 'slider',
      category: 'Scale',
      label: 'Scale Size',
      constraints: {
        slider: {
          min: 45,
          max: 400,
          step: 1,
          formatter: (v) => `${v}px`
        }
      },
      metadata: {
        tooltip: 'Size of individual scale elements',
        description: 'Controls the diameter of each scale element in pixels'
      },
      presets: [
        { name: 'Small', value: 75 },
        { name: 'Medium', value: 150 },
        { name: 'Large', value: 250 },
        { name: 'XL', value: 350 }
      ]
    },
    
    {
      id: 'renderer.scales.scaleSpacing',
      type: 'slider',
      category: 'Scale',
      label: 'Horizontal Spacing',
      constraints: {
        slider: {
          min: -0.4,
          max: 2.0,
          step: 0.01,
          formatter: (v) => `${(v * 100).toFixed(0)}%`,
          bipolar: false,
          detents: [0, 0.5, 1.0]
        }
      },
      metadata: {
        tooltip: 'Horizontal spacing between scale elements',
        description: 'Negative values create overlapping, positive values create gaps'
      },
      presets: [
        { name: 'Overlap', value: -0.2 },
        { name: 'Touch', value: 0 },
        { name: 'Spaced', value: 0.5 },
        { name: 'Wide', value: 1.0 }
      ]
    },
    
    {
      id: 'renderer.scales.verticalOverlap',
      type: 'slider',
      category: 'Scale',
      label: 'Vertical Spacing',
      constraints: {
        slider: {
          min: -0.4,
          max: 2.0,
          step: 0.01,
          formatter: (v) => `${(v * 100).toFixed(0)}%`,
          detents: [0, 0.5, 1.0]
        }
      },
      metadata: {
        tooltip: 'Vertical spacing between scale rows'
      }
    },
    
    {
      id: 'renderer.scales.horizontalOffset',
      type: 'slider',
      category: 'Scale',
      label: 'Horizontal Offset',
      constraints: {
        slider: {
          min: 0,
          max: 1,
          step: 0.01,
          formatter: (v) => `${(v * 100).toFixed(0)}%`
        }
      },
      metadata: {
        tooltip: 'Horizontal offset between alternating rows'
      }
    },
    
    {
      id: 'renderer.scales.shapeMorph',
      type: 'slider',
      category: 'Scale',
      label: 'Shape Form',
      constraints: {
        slider: {
          min: 0,
          max: 1,
          step: 0.01,
          formatter: (v) => {
            if (v < 0.05) return 'Circle';
            if (v > 0.45 && v < 0.55) return 'Diamond';
            if (v > 0.95) return 'Star';
            if (v < 0.5) return 'Circle → Diamond';
            return 'Diamond → Star';
          },
          detents: [0, 0.5, 1.0],
          logarithmic: false
        }
      },
      metadata: {
        tooltip: 'Morphs the shape from circle to diamond to star',
        description: 'Blend between different geometric shapes'
      },
      presets: [
        { name: 'Circle', value: 0 },
        { name: 'Diamond', value: 0.5 },
        { name: 'Star', value: 1.0 }
      ]
    },
    
    // === Border Configuration ===
    {
      id: 'renderer.scales.scaleBorderColor',
      type: 'color',
      category: 'Border',
      label: 'Border Color',
      constraints: {
        color: {
          format: 'hex',
          palette: [
            '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'
          ]
        }
      },
      metadata: {
        tooltip: 'Color of the scale border'
      },
      presets: [
        { name: 'Black', value: '#000000' },
        { name: 'White', value: '#FFFFFF' },
        { name: 'Red', value: '#FF0000' },
        { name: 'Blue', value: '#0000FF' }
      ]
    },
    
    {
      id: 'renderer.scales.scaleBorderWidth',
      type: 'slider',
      category: 'Border',
      label: 'Border Size',
      constraints: {
        slider: {
          min: 0,
          max: 10,
          step: 0.1,
          formatter: (v) => `${v.toFixed(1)}px`,
          detents: [0, 2, 5]
        }
      },
      metadata: {
        tooltip: 'Width of the border around each scale',
        dependencies: [
          {
            property: 'renderer.scales.scaleBorderColor',
            condition: DependencyConditions.notEquals('#000000'),
            effect: 'enable'
          }
        ]
      }
    },
    
    // === Advanced Border (conditional) ===
    {
      id: 'renderer.scales.borderGlow',
      type: 'toggle',
      category: 'Border',
      label: 'Border Glow',
      constraints: {
        toggle: {
          style: 'switch',
          onLabel: 'Glow On',
          offLabel: 'Glow Off'
        }
      },
      metadata: {
        tooltip: 'Add a glowing effect to borders',
        dependencies: [
          {
            property: 'renderer.scales.scaleBorderWidth',
            condition: DependencyConditions.greaterThan(0),
            effect: 'show'
          }
        ]
      }
    },
    
    {
      id: 'renderer.scales.borderGlowIntensity',
      type: 'slider',
      category: 'Border',
      label: 'Glow Intensity',
      constraints: {
        slider: {
          min: 0,
          max: 10,
          step: 0.1,
          formatter: (v) => `${v.toFixed(1)}x`
        }
      },
      metadata: {
        tooltip: 'Intensity of the border glow effect',
        dependencies: [
          {
            property: 'renderer.scales.borderGlow',
            condition: DependencyConditions.isTrue,
            effect: 'show'
          }
        ]
      }
    },
    
    // === Rotation ===
    {
      id: 'renderer.scales.textureRotationSpeed',
      type: 'slider',
      category: 'Transform',
      label: 'Rotation Speed',
      constraints: {
        slider: {
          min: -5,
          max: 5,
          step: 0.1,
          bipolar: true,
          formatter: (v) => {
            if (Math.abs(v) < 0.05) return 'Stopped';
            const speed = Math.abs(v).toFixed(1);
            return v > 0 ? `→ ${speed}` : `← ${speed}`;
          },
          detents: [0]
        }
      },
      metadata: {
        tooltip: 'Speed and direction of texture rotation',
        description: 'Positive values rotate clockwise, negative counter-clockwise'
      },
      presets: [
        { name: 'Stop', value: 0 },
        { name: 'Slow ←', value: -1 },
        { name: 'Slow →', value: 1 },
        { name: 'Fast →', value: 3 }
      ]
    },
    
    // === Scale Gradient ===
    {
      id: 'renderer.scales.gradientColors',
      type: 'gradient',
      category: 'Colors',
      label: 'Scale Gradient',
      constraints: {
        gradient: {
          minColors: 2,
          maxColors: 10,
          allowHardStops: true,
          supportsHardStops: true,
          format: 'array'
        }
      },
      metadata: {
        tooltip: 'Gradient colors for scale elements'
      },
      presets: [
        { name: 'Fire', value: [
          { id: '1', color: '#FF0000', hardStop: false },
          { id: '2', color: '#FFFF00', hardStop: false }
        ]},
        { name: 'Ocean', value: [
          { id: '1', color: '#0066CC', hardStop: false },
          { id: '2', color: '#00CCFF', hardStop: false }
        ]},
        { name: 'Sunset', value: [
          { id: '1', color: '#FF6600', hardStop: false },
          { id: '2', color: '#FF0066', hardStop: false },
          { id: '3', color: '#6600FF', hardStop: false }
        ]}
      ]
    },
    
    // === Animation Controls ===
    {
      id: 'common.animationSpeed',
      type: 'slider',
      category: 'Animation',
      label: 'Animation Speed',
      constraints: {
        slider: {
          min: 0.10,
          max: 2.50,
          step: 0.05,
          formatter: (v) => `${v.toFixed(2)}x`,
          detents: [1.0],
          logarithmic: false
        }
      },
      metadata: {
        tooltip: 'Speed of gradient animation',
        description: 'Controls how fast colors animate through the scale'
      },
      presets: [
        { name: 'Slow', value: 0.5 },
        { name: 'Normal', value: 1.0 },
        { name: 'Fast', value: 2.0 }
      ]
    },
    
    {
      id: 'common.animationDirection',
      type: 'slider',
      category: 'Animation',
      label: 'Animation Direction',
      constraints: {
        slider: {
          min: 0,
          max: 360,
          step: 1,
          formatter: (v) => `${Math.round(v)}°`,
          detents: [0, 90, 180, 270]
        }
      },
      metadata: {
        tooltip: 'Direction of gradient animation',
        description: 'Angle in degrees for animation flow'
      },
      presets: [
        { name: 'Right', value: 0 },
        { name: 'Down', value: 90 },
        { name: 'Left', value: 180 },
        { name: 'Up', value: 270 }
      ]
    },
    
    // === Background ===
    {
      id: 'common.backgroundGradientColors',
      type: 'gradient',
      category: 'Background',
      label: 'Background Gradient',
      constraints: {
        gradient: {
          minColors: 1,
          maxColors: 5,
          allowHardStops: true,
          supportsHardStops: true,
          format: 'array'
        }
      },
      metadata: {
        tooltip: 'Background gradient behind scales'
      },
      presets: [
        { name: 'Black', value: [
          { id: '1', color: '#000000', hardStop: false }
        ]},
        { name: 'Dark Gray', value: [
          { id: '1', color: '#333333', hardStop: false }
        ]},
        { name: 'Blue Fade', value: [
          { id: '1', color: '#001122', hardStop: false },
          { id: '2', color: '#003366', hardStop: false }
        ]}
      ]
    },
    
    // === Performance Mode (conditional advanced settings) ===
    {
      id: 'renderer.scales.performanceMode',
      type: 'select',
      category: 'Advanced',
      label: 'Performance Mode',
      constraints: {
        select: {
          options: [
            { value: 'quality', label: 'Quality', description: 'Best visual quality' },
            { value: 'balanced', label: 'Balanced', description: 'Balance quality and performance' },
            { value: 'performance', label: 'Performance', description: 'Best frame rate' }
          ],
          searchable: false
        }
      },
      metadata: {
        tooltip: 'Adjust rendering quality vs performance'
      }
    },
    
    // === Advanced Texture Settings (only show in performance mode) ===
    {
      id: 'renderer.scales.textureResolution',
      type: 'select',
      category: 'Advanced',
      label: 'Texture Resolution',
      constraints: {
        select: {
          options: [
            { value: '512', label: '512x512', description: 'Low resolution' },
            { value: '1024', label: '1024x1024', description: 'Medium resolution' },
            { value: '2048', label: '2048x2048', description: 'High resolution' },
            { value: '4096', label: '4096x4096', description: 'Ultra resolution' }
          ]
        }
      },
      metadata: {
        tooltip: 'Resolution of internal textures',
        dependencies: [
          {
            property: 'renderer.scales.performanceMode',
            condition: DependencyConditions.equals('performance'),
            effect: 'show'
          }
        ]
      }
    },
    
    // === Vector2D Example ===
    {
      id: 'renderer.scales.centerOffset',
      type: 'vector2d',
      category: 'Transform',
      label: 'Center Offset',
      constraints: {
        vector2d: {
          xRange: [-1, 1],
          yRange: [-1, 1],
          gridSnap: false,
          polarMode: false,
          lockAspectRatio: false
        }
      },
      metadata: {
        tooltip: 'Offset the pattern center point',
        description: 'Move the entire pattern relative to center'
      }
    },
    
    // === Range Example ===
    {
      id: 'renderer.scales.scaleRange',
      type: 'range',
      category: 'Scale',
      label: 'Scale Size Range',
      constraints: {
        range: {
          min: 0.1,
          max: 5.0,
          step: 0.1,
          formatter: (v) => `${v.toFixed(1)}x`
        }
      },
      metadata: {
        tooltip: 'Random scale size variation range',
        description: 'Each scale will randomly vary in size within this range'
      }
    }
  ]
};

/**
 * Helper function to get category order for rendering
 */
export const webglCategoryOrder = [
  'Scale',
  'Border', 
  'Colors',
  'Animation',
  'Transform',
  'Background',
  'Advanced'
];