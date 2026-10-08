import { isPanel, isRecord } from './home-content';
import type { ContentPanel } from './home-content';

export type TechnologyContent = {
  section: { title: string; subtitle: string };
  panels: ContentPanel[];
  disclaimer: string;
};

function isTechnologyPanel(value: unknown): value is ContentPanel {
  return isRecord(value)
    && typeof value.number === 'string'
    && Array.isArray(value.details) && value.details.every((item) => typeof item === 'string')
    && Array.isArray(value.subsections) && value.subsections.every((item) =>
      isRecord(item) && typeof item.title === 'string' && typeof item.text === 'string')
    && typeof value.after === 'string'
    && typeof value.video_url === 'string'
    && (value.video_url === '' || /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(value.video_url))
    && isPanel(value);
}

export function parseTechnologyContent(value: unknown): TechnologyContent {
  if (!isRecord(value) || !isRecord(value.section) || typeof value.section.title !== 'string'
    || typeof value.section.subtitle !== 'string' || typeof value.disclaimer !== 'string'
    || !Array.isArray(value.panels) || value.panels.length === 0 || !value.panels.every(isTechnologyPanel)
    || new Set(value.panels.map((panel) => panel.id)).size !== value.panels.length) {
    throw new Error('The website returned invalid technology content. Please try again.');
  }
  return { section: { title: value.section.title, subtitle: value.section.subtitle }, panels: value.panels, disclaimer: value.disclaimer };
}
