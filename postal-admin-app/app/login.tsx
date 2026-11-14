import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, TextField } from '../components/ui';
import { useAuth } from '../lib/auth/auth-context';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { t, locale, setLocale, isRtl } = useI18n();
  const { login, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/invalid/i.test(message) ? t('login.invalid') : message ? `${t('common.error')}: ${message}` : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.brand, isRtl && styles.rowReverse]}>
            <View style={[styles.logo, { backgroundColor: colors.primary }]}>
              <Text style={[styles.logoText, { color: colors.primaryText }]}>P</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{t('login.title')}</Text>
          </View>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('login.subtitle')}</Text>

          <Card style={styles.card}>
            <TextField
              label={t('login.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="admin@postal.com"
              testID="login-email"
            />
            <TextField
              label={t('login.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              placeholder="••••••••"
              testID="login-password"
            />

            {status === 'forbidden' ? (
              <Text style={[styles.error, { color: colors.danger }]}>{t('login.forbidden')}</Text>
            ) : null}
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

            <Button
              label={submitting ? t('login.submitting') : t('login.submit')}
              onPress={() => void onSubmit()}
              loading={submitting}
              disabled={!email.trim() || !password}
              testID="login-submit"
            />
          </Card>

          <Pressable
            onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            style={styles.langSwitch}
          >
            <Text style={[styles.langText, { color: colors.primary }]}>
              {locale === 'ar' ? 'English' : 'العربية'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, marginBottom: 8 },
  card: { gap: 14 },
  error: { fontSize: 13 },
  langSwitch: { alignSelf: 'center', padding: 10 },
  langText: { fontSize: 14, fontWeight: '600' },
});
