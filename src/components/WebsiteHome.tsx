import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { getHomeContent } from '../api/home';
import { HomeContent } from '../api/home-content';
import { colors, homeStyles } from '../theme';
import { HeroCarousel } from './HeroCarousel';
import { HomePanels } from './HomePanels';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

export function WebsiteHome() {
  const [content, setContent] = useState<HomeContent | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const loadContent = useCallback((forceRefresh = false) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    getHomeContent(forceRefresh)
      .then((nextContent) => { if (requestIdRef.current === requestId) setContent(nextContent); })
      .catch((err: unknown) => {
        if (requestIdRef.current === requestId) setError(err instanceof Error ? err.message : 'Unable to load website content.');
      })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false); });
  }, []);

  useFocusEffect(useCallback(() => {
    loadContent();
    return () => { requestIdRef.current += 1; };
  }, [loadContent]));

  return (
    <>
      {loading ? <ActivityIndicator accessibilityLabel="Loading website home page" color={colors.primary} /> : null}
      {error ? (
        <SectionCard>
          <Text style={homeStyles.cardTitle}>Website content unavailable</Text>
          <Text style={homeStyles.error}>{error}</Text>
          {content ? <Text style={homeStyles.body}>Showing the previously loaded panels.</Text> : null}
          <PrimaryButton label="TRY AGAIN" onPress={() => loadContent(true)} />
        </SectionCard>
      ) : null}
      {content ? (
        <>
          <HeroCarousel key={JSON.stringify(content.slides)} slides={content.slides} />
          <HomePanels content={content} />
        </>
      ) : null}
    </>
  );
}
