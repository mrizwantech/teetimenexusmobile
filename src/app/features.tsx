import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { getHomeContent } from '../api/home';
import { HomeContent } from '../api/home-content';
import { BrandMark } from '../components/BrandMark';
import { HomePanels } from '../components/HomePanels';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, homeStyles } from '../theme';

export default function FeaturesScreen() {
  const [content, setContent] = useState<HomeContent | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const loadContent = useCallback((forceRefresh = false) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    getHomeContent(forceRefresh)
      .then((result) => { if (requestIdRef.current === requestId) setContent(result); })
      .catch((err: unknown) => {
        if (requestIdRef.current === requestId) setError(err instanceof Error ? err.message : 'Unable to load features.');
      })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false); });
  }, []);

  useFocusEffect(useCallback(() => {
    loadContent();
    return () => { requestIdRef.current += 1; };
  }, [loadContent]));

  return (
    <Screen>
      <ScreenHeader><BrandMark /><Text style={homeStyles.kicker}>FEATURES</Text></ScreenHeader>
      {loading ? <ActivityIndicator accessibilityLabel="Loading features" color={colors.primary} /> : null}
      {error ? <SectionCard>
        <Text style={homeStyles.cardTitle}>Features unavailable</Text>
        <Text style={homeStyles.error}>{error}</Text>
        {content ? <Text style={homeStyles.body}>Showing the previously loaded features.</Text> : null}
        <PrimaryButton label="TRY AGAIN" onPress={() => loadContent(true)} disabled={loading} />
      </SectionCard> : null}
      {content ? <HomePanels content={content} columns={2} mediaOnly /> : null}
    </Screen>
  );
}
