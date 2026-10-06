import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { StayTunedModal } from '../components/HeroCarousel';
import { HomeHeader } from '../components/HomeHeader';
import { ProfileHome } from '../components/ProfileHome';
import { Screen } from '../components/Screen';
import { WebsiteHome } from '../components/WebsiteHome';
import { NotificationIntro } from '../components/NotificationIntro';
import { useAuth } from '../context/AuthContext';
import { usePush } from '../context/PushContext';
import { colors } from '../theme';

export default function HomeScreen() {
  const { user, isLoading } = useAuth();
  const { loading: pushLoading, introReady, showIntro } = usePush();
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    if (isLoading || user || pushLoading || !introReady || showIntro) return;
    const timer = setTimeout(() => setShowComingSoon(true), 700);
    return () => clearTimeout(timer);
  }, [isLoading, user, pushLoading, introReady, showIntro]);

  return (
    <Screen>
      <HomeHeader />
      <NotificationIntro />
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : user ? (
        <ProfileHome user={user} />
      ) : (
        <WebsiteHome />
      )}
      <StayTunedModal visible={showComingSoon} onClose={() => setShowComingSoon(false)} />
    </Screen>
  );
}
