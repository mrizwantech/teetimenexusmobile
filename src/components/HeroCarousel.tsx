import { useEffect, useRef, useState } from 'react';
import { ImageBackground, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Link } from 'expo-router';

import { PrimaryButton } from './PrimaryButton';
import { colors, homeStyles as styles, spacing } from '../theme';

const slides = [
    {
        image: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=1600&q=80',
        kicker: 'COMING SOON',
        title: 'Grand opening coming soon.',
        body: 'We are preparing something special for golfers in the area. Check back soon for updates and opening details.',
        action: 'Stay tuned',
    },
    {
        image: 'https://images.unsplash.com/photo-1593111774278-0b6b02b7961c?auto=format&fit=crop&w=1600&q=80',
        kicker: 'OPENING SOON',
        title: 'A premium simulator experience is on the way.',
        body: 'Follow our launch updates for bay availability and special early access announcements.',
        action: 'Follow updates',
    },
    {
        image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1600&q=80',
        kicker: 'GRAND OPENING',
        title: 'Your next round starts here.',
        body: 'Stay connected for the official opening announcement, booking launch, and member access details.',
        action: 'Watch for launch',
    },
];

export function HeroCarousel() {
    const { width: windowWidth } = useWindowDimensions();
    const slideWidth = Math.max(windowWidth - spacing.lg * 2, 280);
    const scrollRef = useRef<ScrollView>(null);
    const currentIndexRef = useRef(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showSignup, setShowSignup] = useState(false);

    function goToSlide(index: number) {
        currentIndexRef.current = index;
        setCurrentIndex(index);
        scrollRef.current?.scrollTo({ x: index * slideWidth, animated: true });
    }

    useEffect(() => {
        const timer = setInterval(() => {
            const nextIndex = (currentIndexRef.current + 1) % slides.length;
            currentIndexRef.current = nextIndex;
            setCurrentIndex(nextIndex);
            scrollRef.current?.scrollTo({ x: nextIndex * slideWidth, animated: true });
        }, 5000);

        return () => clearInterval(timer);
    }, [slideWidth]);

    return (
        <View style={[styles.carousel, { width: slideWidth }]}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
                    currentIndexRef.current = index;
                    setCurrentIndex(index);
                }}
            >
                {slides.map((slide) => (
                    <ImageBackground key={slide.title} source={{ uri: slide.image }} style={[styles.slide, { width: slideWidth }]} imageStyle={styles.slideImage}>
                        <View style={styles.copyPanel}>
                            <Text style={styles.kicker}>{slide.kicker}</Text>
                            <Text style={styles.title}>{slide.title}</Text>
                            <Text style={styles.body}>{slide.body}</Text>
                            {slide.action === 'Stay tuned' ? (
                                <PrimaryButton label={slide.action} onPress={() => setShowSignup(true)} />
                            ) : (
                                <Link href="/book" asChild><PrimaryButton label={slide.action} /></Link>
                            )}
                        </View>
                    </ImageBackground>
                ))}
            </ScrollView>
            <Pressable accessibilityLabel="Previous slide" accessibilityRole="button" onPress={() => goToSlide((currentIndex - 1 + slides.length) % slides.length)} style={[styles.arrow, styles.previousArrow]}>
                <Text style={styles.arrowText}>‹</Text>
            </Pressable>
            <Pressable accessibilityLabel="Next slide" accessibilityRole="button" onPress={() => goToSlide((currentIndex + 1) % slides.length)} style={[styles.arrow, styles.nextArrow]}>
                <Text style={styles.arrowText}>›</Text>
            </Pressable>
            <View style={styles.dots} accessibilityLabel="Carousel pagination">
                {slides.map((slide, index) => (
                    <Pressable key={slide.title} accessibilityLabel={`Go to slide ${index + 1}`} accessibilityRole="button" onPress={() => goToSlide(index)} style={[styles.dot, index === currentIndex && styles.activeDot]} />
                ))}
            </View>
            <StayTunedModal visible={showSignup} onClose={() => setShowSignup(false)} />
        </View>
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
                                <Text style={styles.modalTitle}>Be First to Tee Off</Text>
                                <Text style={styles.modalBody}>Thanks. You are on the Tee Time Nexus launch list.</Text>
                                <PrimaryButton label="DONE" onPress={closeModal} />
                            </>
                        ) : (
                            <>
                                <Text style={styles.modalTitle}>Be First to Tee Off</Text>
                                <Text style={styles.modalSubtitle}>Your next round starts here.</Text>
                                <Text style={styles.modalBody}>
                                    Tee Time Nexus is getting ready to open in Mooresville. Join our list for grand opening updates, early
                                    booking opportunities, and special launch announcements.
                                </Text>
                                {error ? <Text style={styles.error}>{error}</Text> : null}
                                <View style={styles.field}>
                                    <Text style={styles.fieldLabel}>Full Name</Text>
                                    <TextInput style={styles.modalInput} placeholder="Full Name" placeholderTextColor={colors.subtle} value={fullName} onChangeText={setFullName} />
                                </View>
                                <View style={styles.field}>
                                    <Text style={styles.fieldLabel}>Email Address</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Email Address"
                                        placeholderTextColor={colors.subtle}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>
                                <View style={styles.field}>
                                    <Text style={styles.fieldLabel}>Phone Number</Text>
                                    <TextInput style={styles.modalInput} placeholder="Phone Number" placeholderTextColor={colors.subtle} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                                </View>
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
