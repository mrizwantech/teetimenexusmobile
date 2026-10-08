export type HomeAction = {
  label: string;
  route: '/membership' | '/book';
};

export type HomeSlide = {
  id: string;
  image: string;
  kicker: string;
  heading: string;
  text: string;
  actions: HomeAction[];
};

export type HomePanel = {
  id: string;
  title: string;
  text: string;
  media: string;
  media_type: 'image' | 'gif' | 'video';
};

export type ContentPanel = HomePanel & {
  number?: string;
  details?: string[];
  subsections?: { title: string; text: string }[];
  after?: string;
  video_url?: string;
};

export type HomeContent = {
  slides: HomeSlide[];
  section: { title: string; subtitle: string };
  panels: HomePanel[];
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isAction(value: unknown): value is HomeAction {
  return isRecord(value) && typeof value.label === 'string' && value.label.trim() !== ''
    && (value.route === '/membership' || value.route === '/book');
}

function isSlide(value: unknown): value is HomeSlide {
  return isRecord(value) && typeof value.id === 'string' && value.id !== ''
    && isMediaUrl(value.image) && typeof value.kicker === 'string'
    && typeof value.heading === 'string' && typeof value.text === 'string'
    && Array.isArray(value.actions) && value.actions.length > 0 && value.actions.every(isAction);
}

export function isPanel(value: unknown): value is HomePanel {
  return isRecord(value) && typeof value.id === 'string' && value.id !== ''
    && typeof value.title === 'string' && typeof value.text === 'string'
    && isMediaUrl(value.media)
    && (value.media_type === 'image' || value.media_type === 'gif' || value.media_type === 'video');
}

export function parseHomeContent(value: unknown): HomeContent {
  if (!isRecord(value) || !Array.isArray(value.slides) || value.slides.length === 0
    || !value.slides.every(isSlide) || !Array.isArray(value.panels) || !value.panels.every(isPanel)
    || !isRecord(value.section) || typeof value.section.title !== 'string'
    || typeof value.section.subtitle !== 'string'
    || new Set(value.slides.map((slide) => slide.id)).size !== value.slides.length
    || new Set(value.panels.map((panel) => panel.id)).size !== value.panels.length) {
    throw new Error('The website returned invalid home-page content. Please try again.');
  }
  return { slides: value.slides, section: { title: value.section.title, subtitle: value.section.subtitle }, panels: value.panels };
}
