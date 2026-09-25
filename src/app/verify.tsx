import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { startCheckout } from '../api/checkout';
import { submitVerification } from '../api/verification';
import { BrandMark } from '../components/BrandMark';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen, ScreenHeader } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
import { colors, spacing } from '../theme';

export default function VerifyScreen() {
    const params = useLocalSearchParams<{ bay: string; date: string; time: string; duration: string; players: string }>();
    const signatureRef = useRef<SignaturePadHandle>(null);

    const [idImage, setIdImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function pickIdDocument() {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            setError('Photo library access is needed to upload your ID.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setIdImage(result.assets[0]);
            setError('');
        }
    }

    async function handleSubmit() {
        if (!idImage) {
            setError('Please upload a photo of your government-issued ID.');
            return;
        }
        if (!signatureRef.current?.hasSignature()) {
            setError('Please sign in the box to confirm your reservation.');
            return;
        }
        if (!termsAccepted) {
            setError('Please accept the Terms and Conditions.');
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            const signatureDataUrl = await signatureRef.current.capture();

            await submitVerification({
                idDocumentUri: idImage.uri,
                idDocumentName: idImage.fileName ?? 'id-document.jpg',
                idDocumentType: idImage.mimeType ?? 'image/jpeg',
                signatureDataUrl,
            });

            const { bridge_url } = await startCheckout({
                bay: params.bay,
                date: params.date,
                time: params.time,
                duration: Number(params.duration),
                players: Number(params.players),
            });

            await WebBrowser.openBrowserAsync(bridge_url);
            router.back();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Screen>
            <ScreenHeader>
                <BrandMark />
                <Text style={styles.step}>VERIFY YOUR RESERVATION</Text>
            </ScreenHeader>

            <Text style={styles.title}>One quick step</Text>
            <Text style={styles.body}>We verify every first-time reservation. This is only required once.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <SectionCard>
                <Text style={styles.label}>Upload a photo of your government-issued ID</Text>
                {idImage ? (
                    <Image source={{ uri: idImage.uri }} style={styles.idPreview} resizeMode="cover" />
                ) : null}
                <Pressable style={styles.uploadButton} onPress={pickIdDocument}>
                    <Text style={styles.uploadButtonText}>{idImage ? 'Change photo' : 'Choose photo'}</Text>
                </Pressable>

                <Text style={[styles.label, styles.labelSpacer]}>Sign to confirm your reservation</Text>
                <SignaturePad ref={signatureRef} />
                <Pressable style={styles.clearButton} onPress={() => signatureRef.current?.clear()}>
                    <Text style={styles.clearButtonText}>Clear signature</Text>
                </Pressable>

                <Pressable style={styles.termsRow} onPress={() => setTermsAccepted((prev) => !prev)}>
                    <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]} />
                    <Text style={styles.termsText}>I have read and agree to the Terms and Conditions.</Text>
                </Pressable>

                <PrimaryButton label={submitting ? 'Submitting…' : 'Continue to payment'} onPress={handleSubmit} />
            </SectionCard>
        </Screen>
    );
}

const styles = StyleSheet.create({
    step: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    title: { color: colors.heading, fontSize: 34, fontWeight: '900', marginTop: 8 },
    body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 4 },
    label: { color: colors.heading, fontSize: 15, fontWeight: '800', marginBottom: 10 },
    labelSpacer: { marginTop: spacing.md },
    idPreview: { width: '100%', height: 160, borderRadius: 12, marginBottom: 10 },
    uploadButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceSoft,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
    },
    uploadButtonText: { color: colors.text, fontWeight: '700' },
    clearButton: { alignSelf: 'flex-start', marginTop: spacing.xs, marginBottom: spacing.md },
    clearButtonText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.borderStrong, marginTop: 2 },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    termsText: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
    error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
});
