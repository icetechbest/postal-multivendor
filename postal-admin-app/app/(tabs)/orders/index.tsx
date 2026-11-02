import { useQuery } from '@apollo/client';
import { ALL_ORDERS_PAGINATED } from '@/lib/graphql-docs';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OrderRow } from '../../../components/order-row';
import { EmptyState, ErrorState, ListFooter, Screen, TextField } from '../../../components/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { ORDERS_POLL_INTERVAL, ORDER_STATUSES, type TOrderStatus } from '../../../lib/config';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import type { IOrder, IOrdersPage } from '../../../lib/interfaces';
import { useI18n } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';

export default function OrdersScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { handleAuthError } = useAuth();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TOrderStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const variables = useMemo(
    () => ({
      page: 1,
      rows: 15,
      search: debouncedSearch || undefined,
      orderStatus: status ? [status] : undefined,
    }),
    [debouncedSearch, status],
  );

  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery<{
    allOrdersPaginated: IOrdersPage;
  }>(ALL_ORDERS_PAGINATED, {
    variables,
    notifyOnNetworkStatusChange: true,
    pollInterval: ORDERS_POLL_INTERVAL,
  });

  const page = data?.allOrdersPaginated;
  const orders = page?.orders ?? [];
  const isFetchingMore = networkStatus === 3;

  useFocusEffect(
    useCallback(() => {
      void refetch().catch(handleAuthError);
    }, [refetch, handleAuthError]),
  );

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
        const next = fetchMoreResult?.allOrdersPaginated;
        if (!next) return previous;
        const existing = previous.allOrdersPaginated.orders;
        const seen = new Set(existing.map((order) => order._id));
        const merged: IOrder[] = [
          ...existing,
          ...next.orders.filter((order) => !seen.has(order._id)),
        ];
        return {
          allOrdersPaginated: {
            ...next,
            orders: merged,
          },
        };
      },
    }).catch(handleAuthError);
  }, [page, isFetchingMore, fetchMore, variables, handleAuthError]);

  const filters: { key: TOrderStatus | null; label: string }[] = [
    { key: null, label: t('orders.all') },
    ...ORDER_STATUSES.map((value) => ({ key: value, label: value })),
  ];

  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>{t('orders.title')}</Text>
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder={t('orders.search')}
        autoCapitalize="none"
        returnKeyType="search"
        testID="orders-search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {filters.map((filter) => {
          const active = filter.key === status;
          return (
            <Pressable
              key={filter.key ?? 'all'}
              onPress={() => setStatus(filter.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? colors.primaryText : colors.textMuted }]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
        data={orders}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <OrderRow order={item} onPress={() => router.push(`/orders/${item._id}`)} />
        )}
        ListEmptyComponent={
          loading && !data ? <ListFooter loading /> : <EmptyState title={t('orders.empty')} />
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
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontSize: 12, fontWeight: '600' },
});
