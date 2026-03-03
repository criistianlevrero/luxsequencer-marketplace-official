
import { RendererDefinition } from '../types';
import ScalesRenderer from './ScalesRenderer';
import { getScaleTextureSchema } from '../shared/scale-texture-schema';
import { webglRendererControlSpec } from './scales-declarative-schema';

export const webglRenderer: RendererDefinition = {
  id: 'webgl',
  name: 'Escamas WebGL',
  component: ScalesRenderer,
  workerEntry: new URL('./workers/scales.worker.ts', import.meta.url),
  packageManifest: {
    schemaVersion: '1.0.0',
    publisherId: 'luxsequencer',
    repositoryId: 'core-renderers',
    packageId: 'builtin-renderers',
    packageVersion: '0.6.0-beta',
    tool: {
      kind: 'renderer',
      id: 'webgl',
      versionMajor: 1,
    },
    source: 'builtin',
    sdk: {
      minWorkerProtocolVersion: '1.0.0',
    },
  },
  workerRequirements: {
    requiredCapabilities: ['offscreen-canvas', 'webgl2', 'uniform-updates'],
  },
  controlSchema: getScaleTextureSchema,
  declarativeSchema: webglRendererControlSpec,
};
