import { useMutation, useQuery } from '@apollo/client';
import { RESTAURANTS_PAGINATED, TOGGLE_RESTAURANT } from '@postal/graphql-docs';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge, EmptyState, ErrorState, ListFooter, Screen, TextField } from '../../../components/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import type { IRestaurant, IRestaurantsPage } from '../../../lib/interfaces';
import { useI18n } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { formatMoney } from '../../../lib/utils/format';

export default function StoresScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { handleAuthError } = useAuth();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const variables = useMemo(
    () => ({ page: 1, limit: 15, search: debouncedSearch || undefined }),
    [debouncedSearch],
  );

  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery<{
    restaurantsPaginated: IRestaurantsPage;
  }>(RESTAURANTS_PAGINATED, { variables, notifyOnNetworkStatusChange: true });

  const [toggleRestaurant] = useMutation(TOGGLE_RESTAURANT);

  const page = data?.restaurantsPaginated;
  const stores = page?.data ?? [];
  const isFetchingMore = networkStatus === 3;

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

  const loadMore = useCallback(() => {
    if (!page || isFetchingMore || page.currentPage >= page.totalPages) return;
    void fetchMore({
      variables: { ...variables, page: page.currentPage + 1 },
      updateQuery: (previous, { fetchMoreResult }) => {
        const next = fetchMoreResult?.restaurantsPaginated;
        if (!next) return previous;
        const existing = previous.restaurantsPaginated.data;
        const seen = new Set(existing.map((store) => store._id));
        return {
          restaurantsPaginated: {
            ...next,
            data: [...existing, ...next.data.filter((store) => !seen.has(store._id))],
          },
        };
      },
    }).catch(handleAuthError);
  }, [page, isFetchingMore, fetchMore, variables, handleAuthError]);

  const onToggle = useCallback(
    (store: IRestaurant) => {
      Alert.alert(
        t('stores.toggle'),
        `${store.name ?? ''} → ${store.isActive ? t('stores.disabled') : t('stores.enabled')}`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.confirm'),
            onPress: () => {
              toggleRestaurant({
                variables: { id: store._id },
                optimisticResponse: {
                  deleteRestaurant: { __typename: 'Restaurant', _id: store._id, isActive: !store.isActive },
                },
              })
                .then(() => {
                  void refetch();
                  Alert.alert(store.isActive ? t('stores.disabledToast') : t('stores.enabledToast'));
                })
                .catch((err: unknown) => {
                  handleAuthError(err);
                  Alert.alert(t('common.error'));
                });
            },
          },
        ],
      );
    },
    [toggleRestaurant, refetch, t, handleAuthError],
  );

  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>{t('stores.title')}</Text>
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder={t('stores.search')}
        autoCapitalize="none"
        returnKeyType="search"
      />
    </View>
  );

  if (error && !data) {
    return (
      <Screen>
        <ErrorState
          message={t('common.error')}
          onRetry={() => void refetch()}
          retryLabel={t('common.retry')}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={stores}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/stores/${item._id}`)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name ?? t('common.na')}
              </Text>
              <Badge
                label={item.isActive ? t('stores.enabled') : t('stores.disabled')}
                tone={item.isActive ? 'success' : 'danger'}
              />
            </View>
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {item.address ?? t('common.na')} · {item.phone ?? t('common.na')}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                ⭐ {item.rating ?? 0} · {t('stores.orders')} {item.totalOrders ?? 0}
              </Text>
              <Text style={[styles.wallet, { color: colors.primary }]}>{formatMoney(item.wallet)}</Text>
            </View>
            <Pressable
              onPress={() => onToggle(item)}
              style={[styles.toggle, { borderColor: colors.border }]}
            >
              <Text style={[styles.toggleLabel, { color: colors.primary }]}>{t('stores.toggle')}</Text>
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          loading && !data ? <ListFooter loading /> : <EmptyState title={t('stores.noStores')} />
        }
        ListFooterComponent={<ListFooter loading={isFetchingMore} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
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
  header: { gap: 10, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wallet: { fontSize: 13, fontWeight: '800' },
  toggle: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleLabel: { fontSize: 12, fontWeight: '600' },
});
