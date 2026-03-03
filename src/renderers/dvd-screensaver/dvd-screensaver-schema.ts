import type { AccordionItem } from '../../../types';

export const getDvdScreensaverSchema = (): AccordionItem[] => [
  {
    title: 'DVD Screensaver',
    defaultOpen: true,
    controls: [
      {
        type: 'slider',
        id: 'renderer.dvd-screensaver.globalSpeed',
        label: 'Global speed',
        min: 0.1,
        max: 3,
        step: 0.1,
        formatter: (value) => `${value.toFixed(1)}x`,
      },
      {
        type: 'slider',
        id: 'renderer.dvd-screensaver.globalRotationSpeed',
        label: 'Global rotation speed',
        min: 0,
        max: 3,
        step: 0.1,
        formatter: (value) => `${value.toFixed(1)}x`,
      },
    ],
  },
];
