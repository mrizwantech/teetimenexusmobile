import { VENUE_ADDRESS } from './calendar-rules';

const MAPS_PREFERENCE_KEY = 'ttn_directions_app';

export async function getSavedDirectionsOption(platform: string) {
    const saved = platform === 'web'
        ? localStorage.getItem(MAPS_PREFERENCE_KEY)
        : await (await import('expo-secure-store')).getItemAsync(MAPS_PREFERENCE_KEY);
    if (saved === null) return null;
    const option = getDirectionsOptions(platform).find((entry) => entry.label === saved);
    if (!option) throw new Error('Your saved maps app is no longer supported. Please choose another app.');
    return option;
}

export async function saveDirectionsOption(platform: string, label: string) {
    if (!getDirectionsOptions(platform).some((option) => option.label === label)) {
        throw new Error('This maps app is not supported on your device.');
    }
    if (platform === 'web') {
        localStorage.setItem(MAPS_PREFERENCE_KEY, label);
    } else {
        await (await import('expo-secure-store')).setItemAsync(MAPS_PREFERENCE_KEY, label);
    }
}

export function getDirectionsOptions(platform: string) {
    const destination = encodeURIComponent(`Tee Time Nexus, ${VENUE_ADDRESS}`);
    return [
        ...(platform === 'ios' ? [{
            label: 'Apple Maps',
            url: `https://maps.apple.com/?daddr=${destination}&dirflg=d`,
            webUrl: `https://maps.apple.com/?daddr=${destination}&dirflg=d`,
        }] : []),
        {
            label: 'Google Maps',
            url: platform === 'ios'
                ? `comgooglemaps://?daddr=${destination}&directionsmode=driving`
                : platform === 'android'
                    ? `google.navigation:q=${destination}&mode=d`
                    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
            webUrl: `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
        },
        {
            label: 'Waze',
            url: platform === 'ios' || platform === 'android'
                ? `waze://?q=${destination}&navigate=yes`
                : `https://www.waze.com/ul?q=${destination}&navigate=yes`,
            webUrl: `https://www.waze.com/ul?q=${destination}&navigate=yes`,
        },
    ];
}
