import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { getCompetitions } from '../api/competitions';
import type { Competition, CompetitionType } from '../api/competitions-content';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, competitionStyles as styles, homeStyles } from '../theme';

type Filter = 'all' | CompetitionType;

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
}

function formatDateRange(event: Competition) {
  const start = formatDate(event.start_date);
  if (!event.end_date || event.end_date === event.start_date) return start;
  return `${start} – ${formatDate(event.end_date)}`;
}

function formatFee(event: Competition) {
  if (event.entry_fee === null) return 'Entry details coming soon';
  if (event.entry_fee === 0) return 'Free entry';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: event.currency }).format(event.entry_fee);
}

function CompetitionCard({ event }: { event: Competition }) {
  const [opening, setOpening] = useState(false);
  const typeLabel = event.type === 'league' ? 'LEAGUE' : 'TOURNAMENT';

  async function openDetails() {
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(event.url);
    } catch (error) {
      Alert.alert('Unable to open event', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <SectionCard>
      {event.image_url ? <Image accessibilityLabel={`${event.title} event image`} source={{ uri: event.image_url }} resizeMode="cover" style={styles.image} /> : null}
      <Text style={styles.type}>{typeLabel}</Text>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.date}>{formatDateRange(event)}</Text>
      {event.course ? <Text style={styles.detail}>{event.course}</Text> : null}
      {event.format ? <Text style={styles.detail}>{event.format}</Text> : null}
      <Text style={styles.detail}>{formatFee(event)}</Text>
      {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
      <PrimaryButton label={opening ? 'OPENING...' : 'VIEW EVENT DETAILS'} onPress={() => void openDetails()} disabled={opening} />
    </SectionCard>
  );
}

export default function CompetitionsScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [items, setItems] = useState<Competition[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);
  const visibleItems = items.filter((item) => filter === 'all' || item.type === filter);

  const loadCompetitions = useCallback((forceRefresh = false) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    getCompetitions(forceRefresh)
      .then((result) => { if (requestIdRef.current === requestId) setItems(result.items); })
      .catch((err: unknown) => {
        if (requestIdRef.current === requestId) setError(err instanceof Error ? err.message : 'Unable to load competitions.');
      })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false); });
  }, []);

  useFocusEffect(useCallback(() => {
    setFilter(type === 'league' || type === 'tournament' ? type : 'all');
    loadCompetitions();
    return () => { requestIdRef.current += 1; };
  }, [loadCompetitions, type]));

  return (
    <Screen>
      <ScreenHeader><BrandMark /><Text style={homeStyles.kicker}>COMPETITIONS</Text></ScreenHeader>
      <Text style={styles.heading}>Compete. Connect. Conquer.</Text>
      <Text style={styles.intro}>Explore upcoming leagues and tournaments at Tee Time Nexus.</Text>
      <View accessibilityRole="tablist" style={styles.filters}>
        {([
          ['all', 'ALL EVENTS'],
          ['league', 'LEAGUES'],
          ['tournament', 'TOURNAMENTS'],
        ] as const).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={[styles.filter, filter === value && styles.selectedFilter]}
          >
            <Text style={[styles.filterLabel, filter === value && styles.selectedFilterLabel]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading competitions" color={colors.primary} /> : null}
      {error ? <SectionCard>
        <Text style={homeStyles.cardTitle}>Competitions unavailable</Text>
        <Text style={homeStyles.error}>{error}</Text>
        {items.length ? <Text style={homeStyles.body}>Showing previously loaded events.</Text> : null}
        <PrimaryButton label="TRY AGAIN" onPress={() => loadCompetitions(true)} disabled={loading} />
      </SectionCard> : null}
      {!loading && !error && visibleItems.length === 0 ? (
        <SectionCard>
          <Text style={homeStyles.cardTitle}>No events listed yet</Text>
          <Text style={homeStyles.body}>Check back soon for upcoming leagues and tournaments.</Text>
        </SectionCard>
      ) : null}
      {visibleItems.map((event) => <CompetitionCard key={event.id} event={event} />)}
    </Screen>
  );
}
