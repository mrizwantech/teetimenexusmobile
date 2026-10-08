import { isRecord } from './home-content';

export type CompetitionType = 'league' | 'tournament';

export type Competition = {
  id: number;
  title: string;
  type: CompetitionType;
  description: string;
  start_date: string;
  end_date: string;
  registration_start: string;
  registration_end: string;
  entry_fee: number | null;
  currency: string;
  capacity: number;
  format: string;
  course: string;
  image_url: string;
  url: string;
};

export type CompetitionsResponse = {
  items: Competition[];
  count: number;
};

function isDate(value: unknown, optional = false): value is string {
  if (typeof value !== 'string') return false;
  if (optional && value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isWebUrl(value: unknown, optional = false): value is string {
  if (typeof value !== 'string') return false;
  if (optional && value === '') return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isCompetition(value: unknown): value is Competition {
  if (!isRecord(value)) return false;

  return typeof value.id === 'number' && Number.isInteger(value.id) && value.id > 0
    && typeof value.title === 'string' && value.title.trim() !== ''
    && (value.type === 'league' || value.type === 'tournament')
    && typeof value.description === 'string'
    && isDate(value.start_date)
    && isDate(value.end_date, true)
    && isDate(value.registration_start, true)
    && isDate(value.registration_end, true)
    && (value.end_date === '' || value.end_date >= value.start_date)
    && (value.registration_start === '' || value.registration_end === '' || value.registration_end >= value.registration_start)
    && (value.entry_fee === null || (typeof value.entry_fee === 'number' && Number.isFinite(value.entry_fee) && value.entry_fee >= 0))
    && typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency)
    && typeof value.capacity === 'number' && Number.isInteger(value.capacity) && value.capacity >= 0
    && typeof value.format === 'string'
    && typeof value.course === 'string'
    && isWebUrl(value.image_url, true)
    && isWebUrl(value.url);
}

export function parseCompetitions(value: unknown): CompetitionsResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isCompetition)
    || !Number.isInteger(value.count) || value.count !== value.items.length
    || new Set(value.items.map((item) => item.id)).size !== value.items.length) {
    throw new Error('The website returned invalid competition listings. Please try again.');
  }
  return { items: value.items, count: value.count as number };
}
