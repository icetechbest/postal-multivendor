import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth/auth-context';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { Button } from './ui';

export const LockScreen = () => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { unlock, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await unlock();
    if (!ok) setFailed(true);
    setBusy(false);
  };

  useEffect(() => {
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>{t('login.title')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {failed ? t('login.biometricFailed') : t('login.locked')}
        </Text>
        <Button
          label={t('login.biometric')}
          onPress={() => void attempt()}
          loading={busy}
          style={styles.button}
        />
        <Button
          label={t('common.logout')}
          onPress={() => void logout()}
          variant="ghost"
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  title: { fontSize: 24, fontWeight: '700' },
  hint: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  button: { minWidth: 220 },
});
