import { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';

import { ContactEmailStatus, getContactEmailStatus, sendContactEmailCode, verifyContactEmailCode } from '../api/contact-email';
import { useAuth } from '../context/AuthContext';
import { accountStyles as styles, colors } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

export function ContactEmailVerification() {
    const { refreshUser } = useAuth();
    const [status, setStatus] = useState<ContactEmailStatus | null>(null);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        let cancelled = false;
        getContactEmailStatus().then((value) => {
            if (!cancelled) {
                setStatus(value);
                setEmail(value.pending_email ?? '');
            }
        }).catch((err: unknown) => {
            if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load contact-email status.');
        });
        return () => { cancelled = true; };
    }, []);

    async function perform(action: 'load' | 'send' | 'verify') {
        if (busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const value = action === 'load' ? await getContactEmailStatus()
                : action === 'send' ? await sendContactEmailCode(email)
                    : await verifyContactEmailCode(code);
            setStatus(value);
            if (action === 'send') {
                setEmail(value.pending_email ?? '');
                setCode('');
                setNotice('Verification email requested. Check your inbox and spam folder. The code expires in 10 minutes; wait one minute before resending.');
            } else if (action === 'verify') {
                await refreshUser();
                setCode('');
                setNotice('Your contact email is verified. You can continue with membership checkout. Apple sign-in is unchanged.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to verify your contact email.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <SectionCard>
            <Text style={styles.cardTitle}>Contact email</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.body}>{notice}</Text> : null}
            {!status ? <>
                <Text style={styles.body}>{error ? 'Contact-email status is unavailable.' : 'Checking your contact email...'}</Text>
                {error ? <PrimaryButton label="RETRY" disabled={busy} onPress={() => void perform('load')} /> : null}
            </> : status.required || status.pending_email ? <>
                <Text style={styles.body}>Before continuing with membership and door access, add and verify a non-relay email address for access instructions, booking updates, and important account notices. You can continue signing in with Apple.</Text>
                <Text style={styles.body}>Apple Hide My Email can receive mail through its relay. Tee Time Nexus requires a separate verified contact email for member communications. Push notifications depend on your device settings.</Text>
                <Text style={styles.body}>Once verified, this becomes your account email. Your Apple sign-in stays the same.</Text>
                <TextInput accessibilityLabel="Contact email address" style={styles.input} placeholder="Contact email address" placeholderTextColor={colors.subtle} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} value={email} onChangeText={setEmail} />
                <PrimaryButton label={busy ? 'PLEASE WAIT...' : status.pending_email ? 'SEND NEW CODE' : 'SEND VERIFICATION CODE'} disabled={busy || !email.trim()} onPress={() => void perform('send')} />
                {status.pending_email ? <>
                    <Text style={styles.body}>Enter the code sent to {status.pending_email}.</Text>
                    <TextInput accessibilityLabel="Six-digit verification code" style={styles.input} placeholder="6-digit code" placeholderTextColor={colors.subtle} keyboardType="number-pad" maxLength={6} editable={!busy} value={code} onChangeText={setCode} />
                    <PrimaryButton label="VERIFY CONTACT EMAIL" disabled={busy || !/^\d{6}$/.test(code)} onPress={() => void perform('verify')} />
                </> : null}
            </> : <Text style={styles.body}>{status.verified ? 'Verified contact email: ' : 'Account email: '}{status.email}</Text>}
        </SectionCard>
    );
}
