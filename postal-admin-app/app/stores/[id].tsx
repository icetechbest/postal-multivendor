import { useMutation, useQuery } from '@apollo/client';
import { RESTAURANT_BY_ID, TOGGLE_RESTAURANT } from '@/lib/graphql-docs';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, ErrorState, Row, SectionTitle, SkeletonList } from '../../components/ui';
import { useAuth } from '../../lib/auth/auth-context';
import { describeError } from '../../lib/errors';
import type { IRestaurant } from '../../lib/interfaces';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { formatMoney } from '../../lib/utils/format';

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { handleAuthError } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, error, refetch } = useQuery<{ restaurant: IRestaurant }>(
    RESTAURANT_BY_ID,
    { variables: { id }, fetchPolicy: 'cache-and-network', skip: !id },
  );
  const [toggleRestaurant, { loading: toggling }] = useMutation(TOGGLE_RESTAURANT);

  const store = data?.restaurant;

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

  const onToggle = useCallback(() => {
    if (!store) return;
    Alert.alert(t('stores.toggle'), store.isActive ? t('stores.disabled') : t('stores.enabled'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: () => {
          toggleRestaurant({ variables: { id: store._id } })
            .then(() => {
              void refetch();
              Alert.alert(store.isActive ? t('stores.disabledToast') : t('stores.enabledToast'));
            })
            .catch((err: unknown) => {
              handleAuthError(err);
              Alert.alert(t('common.error'), describeError(err, t));
            });
        },
      },
    ]);
  }, [store, toggleRestaurant, refetch, t, handleAuthError]);

  if (loading && !store) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <SkeletonList rows={4} />
      </SafeAreaView>
    );
  }

  if (error || !store) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ErrorState
          message={describeError(error, t)}
          onRetry={() => void refetch()}
          retryLabel={t('common.retry')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]} numberOfLines={1}>
          {store.name}
        </Text>
        <Badge
          label={store.isActive ? t('stores.enabled') : t('stores.disabled')}
          tone={store.isActive ? 'success' : 'danger'}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        <Card>
          <SectionTitle>{t('stores.title')}</SectionTitle>
          <Row label={t('stores.address')} value={store.address ?? t('common.na')} />
          <Row label={t('stores.phone')} value={store.phone ?? t('common.na')} />
          <Row label={t('stores.shopType')} value={store.shopType ?? t('common.na')} />
          <Row label={t('stores.rating')} value={String(store.rating ?? 0)} />
          <Row label={t('stores.orders')} value={String(store.totalOrders ?? 0)} />
          <Row label={t('stores.wallet')} value={formatMoney(store.wallet)} />
          <Row
            label={t('stores.availability')}
            value={store.isAvailable ? t('riders.available') : t('riders.offline')}
          />
        </Card>

        <Card>
          <SectionTitle>{t('stores.owner')}</SectionTitle>
          <Row label={t('more.role')} value={t('stores.owner')} />
          <Row label={t('more.email')} value={store.owner?.email ?? t('common.na')} />
          <Row label={t('more.phone')} value={store.owner?.phone ?? t('common.na')} />
        </Card>

        <Button
          label={store.isActive ? t('stores.disabled') : t('stores.enabled')}
          onPress={onToggle}
          variant={store.isActive ? 'danger' : 'primary'}
          loading={toggling}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { padding: 4 },
  topTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
});
