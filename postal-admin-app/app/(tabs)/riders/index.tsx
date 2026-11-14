import { useQuery } from '@apollo/client';
import { RIDERS } from '@/lib/graphql-docs';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge, EmptyState, ErrorState, ListFooter, Screen } from '../../../components/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { describeError } from '../../../lib/errors';
import { useFocusedPolling } from '../../../lib/hooks/useFocusedPolling';
import type { IRider } from '../../../lib/interfaces';
import { useI18n } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { formatMoney } from '../../../lib/utils/format';

const riderTone = (rider: IRider): 'success' | 'warning' | 'neutral' => {
  if (rider.available || rider.isAvailable) return 'success';
  if (rider.assigned || (rider.status ?? '').toUpperCase() === 'BUSY') return 'warning';
  return 'neutral';
};

export default function RidersScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { handleAuthError } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery<{ riders: IRider[] }>(RIDERS, {
    fetchPolicy: 'cache-and-network',
  });
  useFocusedPolling(startPolling, stopPolling, 30_000);

  const riders = data?.riders ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, handleAuthError]);

  const openLocation = useCallback(
    (rider: IRider) => {
      const coordinates = rider.location?.coordinates;
      if (!coordinates || coordinates.length < 2) {
        Alert.alert(t('riders.location'), t('riders.noLocation'));
        return;
      }
      const [lng, lat] = coordinates;
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      void Linking.openURL(url).catch(() => Alert.alert(t('riders.location'), t('riders.noLocation')));
    },
    [t],
  );

  if (error && !data) {
    return (
      <Screen>
        <ErrorState
          message={describeError(error, t)}
          onRetry={() => void refetch()}
          retryLabel={t('common.retry')}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={riders}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={[styles.title, { color: colors.text }]}>{t('riders.title')}</Text>
        }
        renderItem={({ item }) => {
          const tone = riderTone(item);
          const label =
            tone === 'success'
              ? t('riders.available')
              : tone === 'warning'
                ? t('riders.busy')
                : t('riders.offline');
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name ?? t('common.na')}
                </Text>
                <Badge label={label} tone={tone} />
              </View>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.phone ?? t('common.na')} · {item.vehicleType ?? t('common.na')}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {t('riders.wallet')}: {formatMoney(item.currentWalletAmount)}
                </Text>
                <Pressable onPress={() => openLocation(item)} style={styles.location}>
                  <Text style={[styles.locationLabel, { color: colors.primary }]}>
                    {t('riders.location')}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loading && !data ? <ListFooter loading /> : <EmptyState title={t('riders.noRiders')} />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 10 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  location: { paddingVertical: 4 },
  locationLabel: { fontSize: 12, fontWeight: '700' },
});
