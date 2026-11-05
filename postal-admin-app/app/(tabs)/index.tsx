import { useQuery } from '@apollo/client';
import {
  ALL_ORDERS_PAGINATED,
  DASHBOARD_ORDERS_BY_TYPE,
  DASHBOARD_USERS,
  RIDERS,
  WITHDRAW_REQUESTS,
} from '@/lib/graphql-docs';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, ErrorState, Screen, SectionTitle, SkeletonList } from '../../components/ui';
import { useAuth } from '../../lib/auth/auth-context';
import { describeError } from '../../lib/errors';
import type {
  IChartPoint,
  IDashboardUsers,
  IOrdersPage,
  IRider,
  IWithdrawPage,
} from '../../lib/interfaces';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { formatMoney, formatNumber } from '../../lib/utils/format';

interface IKpiProps {
  label: string;
  value: string;
  hint: string;
  accent: string;
}

const Kpi = ({ label, value, hint, accent }: IKpiProps) => {
  const { colors } = useTheme();
  return (
    <Card style={styles.kpi}>
      <View style={[styles.kpiAccent, { backgroundColor: accent }]} />
      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.kpiHint, { color: colors.textMuted }]}>{hint}</Text>
    </Card>
  );
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { handleAuthError } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const usersQuery = useQuery<{ getDashboardUsers: IDashboardUsers }>(DASHBOARD_USERS, {
    fetchPolicy: 'cache-and-network',
  });
  const ordersChartQuery = useQuery<{ getDashboardOrdersByType: IChartPoint[] }>(
    DASHBOARD_ORDERS_BY_TYPE,
    { fetchPolicy: 'cache-and-network' },
  );
  const todayOrdersQuery = useQuery<{ allOrdersPaginated: IOrdersPage }>(
    ALL_ORDERS_PAGINATED,
    {
      variables: { page: 1, rows: 100, dateKeyword: 'today' },
      fetchPolicy: 'cache-and-network',
    },
  );
  const ridersQuery = useQuery<{ riders: IRider[] }>(RIDERS, {
    fetchPolicy: 'cache-and-network',
  });
  const withdrawalsQuery = useQuery<{ withdrawRequests: IWithdrawPage }>(WITHDRAW_REQUESTS, {
    variables: { pageSize: 50, pageNo: 1 },
    fetchPolicy: 'cache-and-network',
  });

  const loading =
    (usersQuery.loading && !usersQuery.data) ||
    (todayOrdersQuery.loading && !todayOrdersQuery.data);
  const error = usersQuery.error ?? todayOrdersQuery.error ?? ridersQuery.error;

  const todayOrders = todayOrdersQuery.data?.allOrdersPaginated.orders ?? [];
  const revenue = useMemo(
    () => todayOrders.reduce((sum, order) => sum + (order.total ?? order.orderAmount ?? 0), 0),
    [todayOrders],
  );
  const activeRiders = (ridersQuery.data?.riders ?? []).filter(
    (rider) => rider.available || rider.isAvailable,
  ).length;
  const pendingWithdrawals = (withdrawalsQuery.data?.withdrawRequests.data ?? []).filter(
    (request) => (request.status ?? '').toUpperCase() === 'REQUESTED',
  ).length;

  const chart = ordersChartQuery.data?.getDashboardOrdersByType ?? [];
  const chartMax = Math.max(1, ...chart.map((point) => point.value));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        usersQuery.refetch(),
        ordersChartQuery.refetch(),
        todayOrdersQuery.refetch(),
        ridersQuery.refetch(),
        withdrawalsQuery.refetch(),
      ]);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setRefreshing(false);
    }
  }, [usersQuery, ordersChartQuery, todayOrdersQuery, ridersQuery, withdrawalsQuery, handleAuthError]);

  if (loading) {
    return (
      <Screen>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  // A failed background refresh must not replace a dashboard that is already showing.
  if (error && !(usersQuery.data && todayOrdersQuery.data)) {
    return (
      <Screen>
        <ErrorState
          message={describeError(error, t)}
          onRetry={() => void onRefresh()}
          retryLabel={t('common.retry')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
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
        <Text style={[styles.title, { color: colors.text }]}>{t('home.title')}</Text>

        <View style={styles.kpiGrid}>
          <Kpi
            label={t('home.ordersToday')}
            value={formatNumber(todayOrders.length)}
            hint={t('home.ordersTodaySub')}
            accent={colors.primary}
          />
          <Kpi
            label={t('home.revenue')}
            value={formatMoney(revenue)}
            hint={t('home.revenueSub')}
            accent={colors.success}
          />
          <Kpi
            label={t('home.activeRiders')}
            value={formatNumber(activeRiders)}
            hint={t('home.ridersSub')}
            accent={colors.warning}
          />
          <Kpi
            label={t('home.pendingWithdrawals')}
            value={formatNumber(pendingWithdrawals)}
            hint={t('home.withdrawalsSub')}
            accent={colors.danger}
          />
        </View>

        <Card>
          <SectionTitle>{t('home.ordersChart')}</SectionTitle>
          {chart.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t('home.noChart')}</Text>
          ) : (
            chart.map((point) => (
              <View key={point.label} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.textMuted }]} numberOfLines={1}>
                  {point.label}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${Math.round((point.value / chartMax) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barValue, { color: colors.text }]}>{point.value}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '800' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { flexBasis: '47%', flexGrow: 1, gap: 4, overflow: 'hidden' },
  kpiAccent: { position: 'absolute', top: 0, bottom: 0, width: 4, left: 0 },
  kpiLabel: { fontSize: 12, fontWeight: '600' },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiHint: { fontSize: 11 },
  muted: { fontSize: 13 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  barLabel: { width: 92, fontSize: 12 },
  barTrack: { flex: 1, height: 10, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 999 },
  barValue: { width: 34, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});
