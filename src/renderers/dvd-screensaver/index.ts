import type { RendererDefinition } from '../types';
import DvdScreensaverRenderer from './DvdScreensaverRenderer';
import { getDvdScreensaverSchema } from './dvd-screensaver-schema';
import { dvdScreensaverDeclarativeSchema } from './dvd-screensaver-declarative-schema';

export const dvdScreensaverRenderer: RendererDefinition = {
  id: 'dvd-screensaver',
  name: 'DVD Screensaver',
  component: DvdScreensaverRenderer,
  workerEntry: new URL('./workers/dvd-screensaver.worker.ts', import.meta.url),
  packageManifest: {
    schemaVersion: '1.0.0',
    publisherId: 'luxsequencer',
    repositoryId: 'core-renderers',
    packageId: 'builtin-renderers',
    packageVersion: '0.6.0-beta',
    tool: {
      kind: 'renderer',
      id: 'dvd-screensaver',
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
  controlSchema: getDvdScreensaverSchema,
  declarativeSchema: dvdScreensaverDeclarativeSchema,
};
