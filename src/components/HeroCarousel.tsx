import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Link } from 'expo-router';

import { HomeSlide } from '../api/home-content';
import { PrimaryButton } from './PrimaryButton';
import { accountStyles as signupFormStyles, colors, homeStyles as styles, spacing } from '../theme';

export function HeroCarousel({ slides }: { slides: HomeSlide[] }) {
    const { width: windowWidth } = useWindowDimensions();
    const [viewportWidth, setViewportWidth] = useState(Math.max(windowWidth - spacing.lg * 2, 1));
    const cardWidth = Math.max(1, Math.min(420, viewportWidth - (slides.length > 1 ? 28 : 0)));
    const cardInterval = cardWidth + spacing.md;
    const scrollRef = useRef<ScrollView>(null);
    const currentIndexRef = useRef(0);
    const [currentIndex, setCurrentIndex] = useState(0);

    function goToCard(index: number) {
        currentIndexRef.current = index;
        setCurrentIndex(index);
        scrollRef.current?.scrollTo({ x: index * cardInterval, animated: true });
    }

    useEffect(() => {
        scrollRef.current?.scrollTo({ x: currentIndexRef.current * cardInterval, animated: false });
    }, [cardInterval]);

    if (slides.length === 0) return null;
    return (
        <View style={styles.carousel} onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}>
            <ScrollView
                ref={scrollRef}
                horizontal
                snapToInterval={cardInterval}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum
                directionalLockEnabled
                scrollEnabled={slides.length > 1}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.cardTrack, { paddingRight: viewportWidth - cardWidth }]}
                onScroll={(event) => {
                    const index = Math.max(0, Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / cardInterval)));
                    currentIndexRef.current = index;
                    setCurrentIndex(index);
                }}
                scrollEventThrottle={32}
            >
                {slides.map((slide) => (
                    <View key={slide.id} style={[styles.slide, { width: cardWidth }]}>
                        {slide.image ? <HeroCardImage key={slide.image} uri={slide.image} label={slide.heading} /> : null}
                        <View style={styles.copyPanel}>
                            <Text style={styles.kicker}>{slide.kicker}</Text>
                            <Text style={styles.title}>{slide.heading}</Text>
                            <Text style={styles.body}>{slide.text}</Text>
                        </View>
                        <View style={styles.cardActions}>
                            {slide.actions.map((action, index) => (
                                <Link key={action.route} href={action.route} asChild>
                                    <PrimaryButton label={action.label} secondary={index > 0} />
                                </Link>
                            ))}
                        </View>
                    </View>
                ))}
            </ScrollView>
            {slides.length > 1 ? (
                <View style={styles.cardNavigation}>
                    <Text style={styles.cardHint}>Swipe to explore</Text>
                    <View style={styles.dots} accessibilityLabel="Home card pagination">
                        {slides.map((slide, index) => (
                            <Pressable key={slide.id} accessibilityLabel={`Go to card ${index + 1}: ${slide.heading}`} accessibilityRole="button" accessibilityState={{ selected: index === currentIndex }} onPress={() => goToCard(index)} style={styles.dotButton}>
                                <View style={[styles.dot, index === currentIndex && styles.activeDot]} />
                            </Pressable>
                        ))}
                    </View>
                    <Text style={styles.cardHint}>{currentIndex + 1} / {slides.length}</Text>
                </View>
            ) : null}
        </View>
    );
}

function HeroCardImage({ uri, label }: { uri: string; label: string }) {
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    return failed ? (
        <View style={styles.cardImageError}>
            <Text style={styles.error}>This image could not be loaded.</Text>
            <PrimaryButton label="RETRY IMAGE" secondary onPress={() => { setFailed(false); setAttempt((value) => value + 1); }} />
        </View>
    ) : (
        <Image key={attempt} source={{ uri }} accessibilityLabel={label} style={styles.slideImage} contentFit="cover" cachePolicy="disk" onError={() => setFailed(true)} />
    );
}

export function StayTunedModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const mountedRef = useRef(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    async function submitSignup() {
        if (!email.trim() || !phone.trim()) {
            setError('Enter your email address and phone number.');
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            const response = await fetch('https://teetimenexus.com/wp-json/ttn/v1/welcome-signup', {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), phone: phone.trim() }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(typeof data?.message === 'string' ? data.message : 'Unable to submit your signup.');
            }

            if (mountedRef.current) setSubmitted(true);
        } catch (err) {
            if (mountedRef.current) setError(err instanceof Error ? err.message : 'Unable to submit your signup.');
        } finally {
            if (mountedRef.current) setSubmitting(false);
        }
    }

    function closeModal() {
        setFullName('');
        setEmail('');
        setPhone('');
        setError('');
        setSubmitted(false);
        onClose();
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={closeModal}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
                <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.modalCard}>
                        <Pressable accessibilityLabel="Close signup form" accessibilityRole="button" onPress={closeModal} style={styles.closeButton}>
                            <Text style={styles.closeText}>×</Text>
                        </Pressable>
                        {submitted ? (
                            <>
                                <Text style={signupFormStyles.cardTitle}>Be First to Tee Off</Text>
                                <Text style={signupFormStyles.body}>Thanks. You are on the Tee Time Nexus launch list.</Text>
                                <PrimaryButton label="DONE" onPress={closeModal} />
                            </>
                        ) : (
                            <>
                                <Text style={signupFormStyles.cardTitle}>Be First to Tee Off</Text>
                                <Text style={signupFormStyles.body}>
                                    Tee Time Nexus is getting ready to open in Mooresville. Join our list for grand opening updates, early
                                    booking opportunities, and special launch announcements.
                                </Text>
                                {error ? <Text style={styles.error}>{error}</Text> : null}
                                <TextInput style={[signupFormStyles.input, focusedField === 'name' && signupFocusStyles.focusedInput]} placeholder="Full name" placeholderTextColor={colors.subtle} value={fullName} onChangeText={setFullName} onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)} />
                                <TextInput style={[signupFormStyles.input, focusedField === 'email' && signupFocusStyles.focusedInput]} placeholder="Email address" placeholderTextColor={colors.subtle} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} />
                                <TextInput style={[signupFormStyles.input, focusedField === 'phone' && signupFocusStyles.focusedInput]} placeholder="Phone number" placeholderTextColor={colors.subtle} keyboardType="phone-pad" value={phone} onChangeText={setPhone} onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField(null)} />
                                <PrimaryButton label={submitting ? 'SUBMITTING...' : 'SIGN UP FOR UPDATES'} onPress={submitSignup} />
                                <Text style={styles.privacyNote}>We will only contact you with Tee Time Nexus updates and launch information.</Text>
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const signupFocusStyles = StyleSheet.create({
    focusedInput: { borderColor: colors.primary, borderWidth: 1.5 },
});
