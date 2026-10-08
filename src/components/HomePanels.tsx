import { useCallback, useState } from 'react';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ContentPanel, HomeContent, HomePanel } from '../api/home-content';
import { colors, homeStyles, radii, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

export function HomePanels({ content, columns = 1 }: { content: { section: HomeContent['section']; panels: ContentPanel[] }; columns?: 1 | 2 }) {
  const [selectedMedia, setSelectedMedia] = useState<HomePanel | null>(null);
  const [openingVideo, setOpeningVideo] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  useFocusEffect(useCallback(() => () => setSelectedMedia(null), []));

  async function openVideo(url: string) {
    setOpeningVideo(true);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      Alert.alert('Unable to open video', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setOpeningVideo(false);
    }
  }

  return (
    <>
      <View style={styles.heading}>
        <Text style={homeStyles.sectionTitle}>{content.section.title}</Text>
        <Text style={homeStyles.body}>{content.section.subtitle}</Text>
      </View>
      <View style={columns === 2 ? styles.grid : styles.list} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
      {content.panels.map((panel) => (
        <View key={panel.id} style={columns === 2 ? { width: gridWidth ? Math.max(1, (gridWidth - spacing.sm) / 2) : '48%' } : styles.listCard}>
        <SectionCard compact={columns === 2}>
          {panel.media ? panel.video_url ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${panel.title} on YouTube`} disabled={openingVideo} onPress={() => { if (panel.video_url) void openVideo(panel.video_url); }}>
              <PanelImage key={panel.media} panel={panel} />
              <Text style={styles.animationLabel}>Tap to watch on YouTube</Text>
            </Pressable>
          ) : panel.media_type === 'video' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Play ${panel.title} video`} onPress={() => setSelectedMedia(panel)} style={[styles.videoPreview, columns === 2 && styles.compactPreview]}>
              <Text style={columns === 2 ? styles.compactPlayIcon : styles.playIcon}>{'\u25B6'}</Text>
              {columns === 1 ? <Text style={styles.playLabel}>Watch {panel.title}</Text> : null}
            </Pressable>
          ) : panel.media_type === 'gif' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Play ${panel.title} animation`} onPress={() => setSelectedMedia(panel)}>
              <PanelImage key={panel.media} panel={panel} autoplay={false} />
              <Text style={styles.animationLabel}>Tap to play animation</Text>
            </Pressable>
          ) : <PanelImage key={panel.media} panel={panel} /> : null}
          {panel.number ? <Text style={styles.number}>{panel.number}</Text> : null}
          <Text style={columns === 2 ? styles.gridTitle : homeStyles.cardTitle}>{panel.title}</Text>
          <Text style={columns === 2 ? styles.gridBody : homeStyles.body}>{panel.text}</Text>
          {panel.details?.map((detail) => <Text key={detail} style={columns === 2 ? styles.gridBody : homeStyles.body}>{'\u2022'} {detail}</Text>)}
          {panel.subsections?.map((subsection) => (
            <View key={subsection.title} style={styles.subsection}>
              <Text style={styles.subsectionTitle}>{subsection.title}</Text>
              <Text style={columns === 2 ? styles.gridBody : homeStyles.body}>{subsection.text}</Text>
            </View>
          ))}
          {panel.after ? <Text style={columns === 2 ? styles.gridBody : homeStyles.body}>{panel.after}</Text> : null}
        </SectionCard>
        </View>
      ))}
      </View>
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
  list: { gap: spacing.lg },
  listCard: { width: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-start' },
  gridTitle: { color: colors.heading, fontSize: 17, fontWeight: '800', lineHeight: 23, marginBottom: spacing.sm },
  gridBody: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: spacing.sm },
  number: { color: colors.primary, fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  subsection: { gap: spacing.xs },
  subsectionTitle: { color: colors.heading, fontSize: 14, fontWeight: '700' },
  heading: { gap: spacing.sm, paddingTop: spacing.sm },
  mediaContainer: { marginBottom: spacing.sm },
  media: { aspectRatio: 16 / 9, borderRadius: radii.sm, width: '100%', backgroundColor: colors.surfaceStrong },
  mediaError: { gap: spacing.sm, padding: spacing.md },
  videoContainer: { gap: spacing.sm },
  videoPreview: { aspectRatio: 16 / 9, backgroundColor: colors.surfaceStrong, borderColor: colors.borderStrong, borderRadius: radii.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  compactPreview: { padding: spacing.xs },
  compactPlayIcon: { color: colors.primary, fontSize: 24 },
  playIcon: { color: colors.primary, fontSize: 36 },
  playLabel: { color: colors.heading, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  animationLabel: { color: colors.primary, fontSize: 12, fontWeight: '700' },
});
