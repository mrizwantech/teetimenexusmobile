import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { getTechnologyContent } from '../api/technology';
import { TechnologyContent } from '../api/technology-content';
import { BrandMark } from '../components/BrandMark';
import { HomePanels } from '../components/HomePanels';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, homeStyles } from '../theme';

export default function TechnologyScreen() {
  const [content, setContent] = useState<TechnologyContent | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const loadContent = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    getTechnologyContent()
      .then((result) => { if (requestIdRef.current === requestId) setContent(result); })
      .catch((err: unknown) => {
        if (requestIdRef.current === requestId) setError(err instanceof Error ? err.message : 'Unable to load technology content.');
      })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false); });
  }, []);

  useFocusEffect(useCallback(() => {
    loadContent();
    return () => { requestIdRef.current += 1; };
  }, [loadContent]));

  return (
    <Screen>
      <ScreenHeader><BrandMark /><Text style={homeStyles.kicker}>EXPERIENCE</Text></ScreenHeader>
      {loading ? <ActivityIndicator accessibilityLabel="Loading technology panels" color={colors.primary} /> : null}
      {error ? <SectionCard>
        <Text style={homeStyles.cardTitle}>Technology content unavailable</Text>
        <Text style={homeStyles.error}>{error}</Text>
        {content ? <Text style={homeStyles.body}>Showing the previously loaded panels.</Text> : null}
        <PrimaryButton label="TRY AGAIN" onPress={loadContent} disabled={loading} />
      </SectionCard> : null}
      {content ? <>
        <HomePanels content={content} columns={2} />
        <Text style={homeStyles.body}>{content.disclaimer}</Text>
      </> : null}
    </Screen>
  );
}
