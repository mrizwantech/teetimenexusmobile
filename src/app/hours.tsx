import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { getHoursContent } from '../api/hours';
import { HoursContent } from '../api/hours-content';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { colors, homeStyles } from '../theme';

export default function HoursScreen() {
  const [content, setContent] = useState<HoursContent | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const loadContent = useCallback((forceRefresh = false) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    getHoursContent(forceRefresh)
      .then((result) => { if (requestIdRef.current === requestId) setContent(result); })
      .catch((err: unknown) => {
        if (requestIdRef.current === requestId) setError(err instanceof Error ? err.message : 'Unable to load hours and access content.');
      })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false); });
  }, []);

  useFocusEffect(useCallback(() => {
    loadContent();
    return () => { requestIdRef.current += 1; };
  }, [loadContent]));

  return (
    <Screen>
      <ScreenHeader><BrandMark /><Text style={homeStyles.kicker}>HOURS &amp; ACCESS</Text></ScreenHeader>
      {loading ? <ActivityIndicator accessibilityLabel="Loading hours and access" color={colors.primary} /> : null}
      {error ? <SectionCard>
        <Text style={homeStyles.cardTitle}>Hours &amp; Access unavailable</Text>
        <Text style={homeStyles.error}>{error}</Text>
        {content ? <Text style={homeStyles.body}>Showing previously loaded hours. Please retry to confirm the latest information.</Text> : null}
        <PrimaryButton label="TRY AGAIN" onPress={() => loadContent(true)} disabled={loading} />
      </SectionCard> : null}
      {content ? <>
        <Text style={homeStyles.title}>{content.title}</Text>
        {content.sections.map((section) => (
          <SectionCard key={section.id}>
            <Text style={homeStyles.cardTitle}>{section.title}</Text>
            <Text style={homeStyles.title}>{section.time}</Text>
            <Text style={homeStyles.body}>{section.note}</Text>
            <Link href={section.action.route} asChild><PrimaryButton label={section.action.label} /></Link>
          </SectionCard>
        ))}
      </> : null}
    </Screen>
  );
}
