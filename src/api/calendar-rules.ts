export const VENUE_TIME_ZONE = 'America/New_York';
export const VENUE_ADDRESS = '2785 Charlotte Hwy, Suites 11 & 12, Mooresville, NC 28117';

export function getCalendarStartDate(date: string, time: string): Date {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const timeMatch = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(time.trim());
    if (!dateMatch || !timeMatch) throw new Error('This reservation has an invalid date or time.');
    const [, year, month, day] = dateMatch.map(Number);
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const period = timeMatch[3]?.toUpperCase();
    if (minute > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) {
        throw new Error('This reservation has an invalid start time.');
    }
    if (period) hour = hour % 12 + (period === 'PM' ? 12 : 0);
    const wallTime = Date.UTC(year, month - 1, day, hour, minute);
    if (new Date(wallTime).toISOString().slice(0, 10) !== date) {
        throw new Error('This reservation has an invalid date.');
    }
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: VENUE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    const venueWallTime = (instant: number) => {
        const parts = formatter.formatToParts(new Date(instant));
        const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value);
        return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
    };
    let instant = wallTime;
    for (let attempt = 0; attempt < 3; attempt++) {
        instant += wallTime - venueWallTime(instant);
    }
    if (venueWallTime(instant) !== wallTime) {
        throw new Error('This reservation time does not exist in the venue time zone. Please contact Tee Time Nexus.');
    }
    return new Date(instant);
}

export function getCalendarEvent(bay: string, date: string, time: string, duration: number, players: number) {
    if (!bay.trim() || !Number.isInteger(duration) || duration < 1 || duration > 8
        || !Number.isInteger(players) || players < 1 || players > 4) {
        throw new Error('This reservation has invalid calendar details.');
    }
    const startDate = getCalendarStartDate(date, time);
    return {
        title: `Tee Time Nexus - ${bay}`,
        startDate,
        endDate: new Date(startDate.getTime() + duration * 3_600_000),
        notes: `${players} ${players === 1 ? 'player' : 'players'} · ${duration} hour${duration === 1 ? '' : 's'}`,
        location: VENUE_ADDRESS,
        allDay: false,
    };
}

export function getGoogleCalendarUrl(bay: string, date: string, time: string, duration: number, players: number): string {
    const event = getCalendarEvent(bay, date, time, duration, players);
    const format = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const params = new URLSearchParams({
        action: 'TEMPLATE', text: event.title,
        dates: `${format(event.startDate)}/${format(event.endDate)}`,
        details: event.notes, location: event.location, ctz: VENUE_TIME_ZONE,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
