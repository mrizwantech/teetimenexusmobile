import { isRecord } from './home-content';

export type HoursSection = {
  id: string;
  title: string;
  time: string;
  note: string;
  action: { label: string; route: '/membership' | '/book' };
};

export type HoursContent = {
  title: string;
  sections: HoursSection[];
};

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isHoursSection(value: unknown): value is HoursSection {
  return isRecord(value) && isNonemptyString(value.id) && isNonemptyString(value.title)
    && isNonemptyString(value.time) && isNonemptyString(value.note)
    && isRecord(value.action) && isNonemptyString(value.action.label)
    && (value.action.route === '/membership' || value.action.route === '/book');
}

export function parseHoursContent(value: unknown): HoursContent {
  if (!isRecord(value) || !isNonemptyString(value.title) || !Array.isArray(value.sections)
    || value.sections.length === 0 || !value.sections.every(isHoursSection)
    || new Set(value.sections.map((section) => section.id)).size !== value.sections.length) {
    throw new Error('The website returned invalid hours and access content. Please try again.');
  }
  return { title: value.title, sections: value.sections };
}
