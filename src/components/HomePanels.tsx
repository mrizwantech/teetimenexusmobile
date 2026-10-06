import { useCallback, useState } from 'react';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { HomeContent, HomePanel } from '../api/home-content';
import { colors, homeStyles, radii, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

export function HomePanels({ content }: { content: HomeContent }) {
  const [selectedMedia, setSelectedMedia] = useState<HomePanel | null>(null);

  useFocusEffect(useCallback(() => () => setSelectedMedia(null), []));

  return (
    <>
      <View style={styles.heading}>
        <Text style={homeStyles.sectionTitle}>{content.section.title}</Text>
        <Text style={homeStyles.body}>{content.section.subtitle}</Text>
      </View>
      {content.panels.map((panel) => (
        <SectionCard key={panel.id}>
          {panel.media ? panel.media_type === 'video' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Play ${panel.title} video`} onPress={() => setSelectedMedia(panel)} style={styles.videoPreview}>
              <Text style={styles.playIcon}>{'\u25B6'}</Text>
              <Text style={styles.playLabel}>Watch {panel.title}</Text>
            </Pressable>
          ) : panel.media_type === 'gif' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Play ${panel.title} animation`} onPress={() => setSelectedMedia(panel)}>
              <PanelImage key={panel.media} panel={panel} autoplay={false} />
              <Text style={styles.animationLabel}>Tap to play animation</Text>
            </Pressable>
          ) : <PanelImage key={panel.media} panel={panel} /> : null}
          <Text style={homeStyles.cardTitle}>{panel.title}</Text>
          <Text style={homeStyles.body}>{panel.text}</Text>
        </SectionCard>
      ))}
      {selectedMedia ? (
        <Modal animationType="slide" transparent onRequestClose={() => setSelectedMedia(null)}>
          <View style={homeStyles.modalBackdrop}>
            <View style={homeStyles.modalCard}>
              <Text style={homeStyles.cardTitle}>{selectedMedia.title}</Text>
              {selectedMedia.media_type === 'video'
                ? <PanelVideo key={selectedMedia.media} uri={selectedMedia.media} />
                : <PanelImage key={selectedMedia.media} panel={selectedMedia} />}
              <PrimaryButton label="CLOSE MEDIA" onPress={() => setSelectedMedia(null)} />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function PanelImage({ panel, autoplay = true }: { panel: HomePanel; autoplay?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <View style={styles.mediaContainer}>
      {failed ? (
        <View style={styles.mediaError}>
          <Text style={homeStyles.error}>This image could not be loaded.</Text>
          <PrimaryButton label="RETRY IMAGE" secondary onPress={() => { setFailed(false); setAttempt((value) => value + 1); }} />
        </View>
      ) : (
        <Image key={attempt} source={{ uri: panel.media }} accessibilityLabel={panel.title} style={styles.media} contentFit="contain" cachePolicy="disk" autoplay={autoplay} onError={() => setFailed(true)} />
      )}
    </View>
  );
}

function PanelVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.muted = true;
    nextPlayer.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  return (
    <View style={styles.videoContainer}>
      <VideoView player={player} style={styles.media} contentFit="contain" nativeControls surfaceType="textureView" />
      {status === 'loading' ? <ActivityIndicator color={colors.primary} style={StyleSheet.absoluteFill} /> : null}
      {status === 'error' ? <Text style={homeStyles.error}>This video could not be played. Close it and try again.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm, paddingTop: spacing.sm },
  mediaContainer: { marginBottom: spacing.sm },
  media: { aspectRatio: 16 / 9, borderRadius: radii.sm, width: '100%', backgroundColor: colors.surfaceStrong },
  mediaError: { gap: spacing.sm, padding: spacing.md },
  videoContainer: { gap: spacing.sm },
  videoPreview: { aspectRatio: 16 / 9, backgroundColor: colors.surfaceStrong, borderColor: colors.borderStrong, borderRadius: radii.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  playIcon: { color: colors.primary, fontSize: 36 },
  playLabel: { color: colors.heading, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  animationLabel: { color: colors.primary, fontSize: 12, fontWeight: '700' },
});
