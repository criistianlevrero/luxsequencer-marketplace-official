import type { RendererControlSpec } from '@luxsequencer/contracts/declarative-controls';

export const diagnosticFpsDeclarativeSchema: RendererControlSpec = {
  standard: [
    {
      id: 'renderer.diagnostic-fps.targetFps',
      type: 'slider',
      category: 'Sampling',
      label: 'Target FPS',
      constraints: {
        slider: {
          min: 10,
          max: 120,
          step: 1,
          formatter: (value) => `${Math.round(value)} fps`,
          detents: [30, 60, 120],
        },
      },
      metadata: {
        tooltip: 'Render loop target rate for this diagnostic worker',
      },
    },
    {
      id: 'renderer.diagnostic-fps.fpsSmoothingSamples',
      type: 'slider',
      category: 'Sampling',
      label: 'FPS Smoothing Samples',
      constraints: {
        slider: {
          min: 5,
          max: 240,
          step: 1,
          formatter: (value) => `${Math.round(value)} samples`,
          detents: [15, 30, 60, 120],
        },
      },
      metadata: {
        tooltip: 'Moving average window for render FPS',
      },
    },
    {
      id: 'renderer.diagnostic-fps.dataSmoothingSamples',
      type: 'slider',
      category: 'Sampling',
      label: 'Data Smoothing Samples',
      constraints: {
        slider: {
          min: 5,
          max: 240,
          step: 1,
          formatter: (value) => `${Math.round(value)} samples`,
          detents: [15, 30, 60, 120],
        },
      },
      metadata: {
        tooltip: 'Moving average window for data heartbeat intervals',
      },
    },
    {
      id: 'renderer.diagnostic-fps.stallThresholdMs',
      type: 'slider',
      category: 'Thresholds',
      label: 'Stall Threshold',
      constraints: {
        slider: {
          min: 16,
          max: 1000,
          step: 4,
          formatter: (value) => `${Math.round(value)} ms`,
          detents: [33, 50, 100, 200],
        },
      },
      metadata: {
        tooltip: 'Heartbeat interval above this is marked as potential data stall',
      },
    },
    {
      id: 'renderer.diagnostic-fps.graphRangeMs',
      type: 'slider',
      category: 'Thresholds',
      label: 'Graph Max Interval',
      constraints: {
        slider: {
          min: 33,
          max: 1000,
          step: 1,
          formatter: (value) => `${Math.round(value)} ms`,
          detents: [100, 200, 500],
        },
      },
      metadata: {
        tooltip: 'Upper bound of interval chart Y-scale',
      },
    },
    {
      id: 'renderer.diagnostic-fps.payloadBytes',
      type: 'slider',
      category: 'Data Probe',
      label: 'Synthetic Payload Size',
      constraints: {
        slider: {
          min: 0,
          max: 65536,
          step: 256,
          formatter: (value) => `${Math.round(value)} bytes`,
          detents: [0, 1024, 4096, 16384],
        },
      },
      metadata: {
        tooltip: 'Extra bytes attached to each data update (to stress message bandwidth)',
      },
    },
    {
      id: 'renderer.diagnostic-fps.signalCount',
      type: 'slider',
      category: 'Data Probe',
      label: 'Synthetic Signals',
      constraints: {
        slider: {
          min: 1,
          max: 32,
          step: 1,
          formatter: (value) => `${Math.round(value)} signals`,
          detents: [1, 4, 8, 16],
        },
      },
      metadata: {
        tooltip: 'How many animated numeric values are sent on each update',
      },
    },
  ],
};
