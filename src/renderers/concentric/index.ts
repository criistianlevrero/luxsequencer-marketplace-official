
import { RendererDefinition } from '../types';
import ConcentricRenderer from './ConcentricRenderer';
import { getConcentricSchema } from './concentric-schema';
import { concentricDeclarativeSchema } from './concentric-declarative-schema';

export const concentricRenderer: RendererDefinition = {
  id: 'concentric',
  name: 'Concénctrico',
  component: ConcentricRenderer,
  workerEntry: new URL('./workers/concentric.worker.ts', import.meta.url),
  packageManifest: {
    schemaVersion: '1.0.0',
    publisherId: 'luxsequencer',
    repositoryId: 'core-renderers',
    packageId: 'builtin-renderers',
    packageVersion: '0.6.0-beta',
    tool: {
      kind: 'renderer',
      id: 'concentric',
      versionMajor: 1,
    },
    source: 'builtin',
    sdk: {
      minWorkerProtocolVersion: '1.0.0',
    },
  },
  workerRequirements: {
    requiredCapabilities: ['offscreen-canvas', 'canvas2d', 'uniform-updates'],
  },
  controlSchema: getConcentricSchema,
  declarativeSchema: concentricDeclarativeSchema,
};
