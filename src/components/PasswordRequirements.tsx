import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

const passwordRules = [
    { key: 'length', label: 'At least 8 characters', test: (password: string) => password.length >= 8 },
    { key: 'uppercase', label: 'One uppercase letter', test: (password: string) => /[A-Z]/.test(password) },
    { key: 'lowercase', label: 'One lowercase letter', test: (password: string) => /[a-z]/.test(password) },
    { key: 'number', label: 'One number', test: (password: string) => /[0-9]/.test(password) },
    { key: 'symbol', label: 'One symbol', test: (password: string) => /[^A-Za-z0-9\s]/.test(password) },
];

export function PasswordRequirements({ password }: { password: string }) {
    return (
        <View style={styles.list} accessibilityLabel="Password requirements">
            {passwordRules.map((rule) => {
                const isMet = rule.test(password);
                return (
                    <View key={rule.key} style={styles.row}>
                        <Text style={[styles.check, isMet && styles.checkMet]}>{isMet ? '✓' : '○'}</Text>
                        <Text style={[styles.label, isMet && styles.labelMet]}>{rule.label}</Text>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    list: { gap: 5, marginBottom: spacing.sm, marginTop: -spacing.xs },
    row: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
    check: { color: colors.muted, fontSize: 14, fontWeight: '800', width: 18 },
    checkMet: { color: colors.primary },
    label: { color: colors.muted, fontSize: 12 },
    labelMet: { color: colors.text },
});