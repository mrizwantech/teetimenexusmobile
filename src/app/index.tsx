import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { HeroCarousel, StayTunedModal } from '../components/HeroCarousel';
import { HomeHeader } from '../components/HomeHeader';
import { ProfileHome } from '../components/ProfileHome';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { colors, homeStyles as styles } from '../theme';

export default function HomeScreen() {
  const { user, isLoading } = useAuth();
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    if (isLoading || user) return;
    const timer = setTimeout(() => setShowComingSoon(true), 700);
    return () => clearTimeout(timer);
  }, [isLoading, user]);

  return (
    <Screen>
      <HomeHeader />
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : user ? (
        <ProfileHome user={user} />
      ) : (
        <>
          <HeroCarousel />
          <View style={styles.heading}><Text style={styles.sectionTitle}>Why golfers choose us</Text></View>
          <SectionCard><Text style={styles.kicker}>PRECISION</Text><Text style={styles.cardTitle}>Professional simulator setup</Text><Text style={styles.body}>High-speed launch tracking and immersive course play make every session feel like the real thing.</Text></SectionCard>
          <SectionCard><Text style={styles.kicker}>EVENTS</Text><Text style={styles.cardTitle}>Private leagues & parties</Text><Text style={styles.body}>A premium atmosphere for corporate nights, birthdays, and friendly competitions.</Text></SectionCard>
        </>
      )}
      <StayTunedModal visible={showComingSoon} onClose={() => setShowComingSoon(false)} />
    </Screen>
  );
}
