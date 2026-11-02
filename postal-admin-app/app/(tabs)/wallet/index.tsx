import { useMutation, useQuery } from '@apollo/client';
import {
  EARNINGS,
  TRANSACTION_HISTORY,
  UPDATE_WITHDRAW_STATUS,
  WITHDRAW_REQUESTS,
} from '@postal/graphql-docs';
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

import { Badge, Card, ErrorState, Screen, SectionTitle, SkeletonList } from '../../../components/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import type {
  IEarningsResult,
  ITransactionPage,
  IWithdrawPage,
  IWithdrawRequest,
} from '../../../lib/interfaces';
import { useI18n } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { formatDateTime, formatMoney, statusTone } from '../../../lib/utils/format';

type TTab = 'earnings' | 'withdrawals' | 'transactions';

export default function WalletScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { handleAuthError } = useAuth();
  const [tab, setTab] = useState<TTab>('earnings');
  const [refreshing, setRefreshing] = useState(false);

  const earningsQuery = useQuery<{ earnings: IEarningsResult }>(EARNINGS, {
    variables: { pageSize: 20, pageNo: 1 },
    fetchPolicy: 'cache-and-network',
  });
  const withdrawalsQuery = useQuery<{ withdrawRequests: IWithdrawPage }>(WITHDRAW_REQUESTS, {
    variables: { pageSize: 50, pageNo: 1 },
    fetchPolicy: 'cache-and-network',
  });
  const transactionsQuery = useQuery<{ transactionHistory: ITransactionPage }>(
    TRANSACTION_HISTORY,
    {
      variables: { pageSize: 30, pageNo: 1 },
      fetchPolicy: 'cache-and-network',
      skip: tab !== 'transactions',
    },
  );

  const [updateWithdraw] = useMutation(UPDATE_WITHDRAW_STATUS);

  const earnings = earningsQuery.data?.earnings;
  const grand = earnings?.data?.grandTotalEarnings;
  const requests = withdrawalsQuery.data?.withdrawRequests.data ?? [];
  const transactions = transactionsQuery.data?.transactionHistory.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        earningsQuery.refetch(),
        withdrawalsQuery.refetch(),
        tab === 'transactions' ? transactionsQuery.refetch() : Promise.resolve(),
      ]);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setRefreshing(false);
    }
  }, [earningsQuery, withdrawalsQuery, transactionsQuery, tab, handleAuthError]);

  const settle = useCallback(
    (request: IWithdrawRequest, status: 'TRANSFERRED' | 'CANCELLED') => {
      const label = status === 'TRANSFERRED' ? t('wallet.approve') : t('wallet.reject');
      Alert.alert(label, `${request.requestId ?? ''} · ${formatMoney(request.requestAmount)}`, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: label,
          style: status === 'CANCELLED' ? 'destructive' : 'default',
          onPress: () => {
            updateWithdraw({ variables: { id: request._id, status } })
              .then(() => {
                void withdrawalsQuery.refetch();
                void earningsQuery.refetch();
                Alert.alert(status === 'TRANSFERRED' ? t('wallet.approved') : t('wallet.rejected'));
              })
              .catch((err: unknown) => {
                handleAuthError(err);
                Alert.alert(t('common.error'));
              });
          },
        },
      ]);
    },
    [updateWithdraw, withdrawalsQuery, earningsQuery, t, handleAuthError],
  );

  if (earningsQuery.error && !earningsQuery.data) {
    return (
      <Screen>
        <ErrorState
          message={t('common.error')}
          onRetry={() => void onRefresh()}
          retryLabel={t('common.retry')}
        />
      </Screen>
    );
  }

  const tabs: { key: TTab; label: string }[] = [
    { key: 'earnings', label: t('wallet.earnings') },
    { key: 'withdrawals', label: t('wallet.withdrawals') },
    { key: 'transactions', label: t('wallet.transactions') },
  ];

  return (
    <Screen padded={false}>
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
        <Text style={[styles.title, { color: colors.text }]}>{t('wallet.title')}</Text>

        <View style={styles.tabs}>
          {tabs.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.tabLabel, { color: active ? colors.primaryText : colors.textMuted }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'earnings' ? (
          earningsQuery.loading && !earnings ? (
            <SkeletonList rows={3} />
          ) : (
            <>
              <Card>
                <SectionTitle>{t('wallet.grandTotal')}</SectionTitle>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCell}>
                    <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                      {t('wallet.platform')}
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {formatMoney(grand?.platformTotal)}
                    </Text>
                  </View>
                  <View style={styles.summaryCell}>
                    <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                      {t('wallet.riders')}
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {formatMoney(grand?.riderTotal)}
                    </Text>
                  </View>
                  <View style={styles.summaryCell}>
                    <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                      {t('wallet.stores')}
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {formatMoney(grand?.storeTotal)}
                    </Text>
                  </View>
                </View>
              </Card>

              {(earnings?.data?.earnings ?? []).map((row) => (
                <Card key={row._id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {row.orderId ?? row._id.slice(-6)}
                    </Text>
                    <Text style={[styles.rowAmount, { color: colors.primary }]}>
                      {formatMoney(row.platformEarnings?.totalEarnings)}
                    </Text>
                  </View>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {row.paymentMethod ?? t('common.na')} · {formatDateTime(row.createdAt)}
                  </Text>
                </Card>
              ))}
            </>
          )
        ) : null}

        {tab === 'withdrawals' ? (
          requests.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t('wallet.noRequests')}</Text>
          ) : (
            requests.map((request) => {
              const status = (request.status ?? '').toUpperCase();
              const pending = status === 'REQUESTED';
              return (
                <Card key={request._id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {request.requestId ?? request._id.slice(-6)}
                    </Text>
                    <Badge
                      label={status}
                      tone={status === 'TRANSFERRED' ? 'success' : status === 'CANCELLED' ? 'danger' : statusTone(status)}
                    />
                  </View>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {request.rider?.name ?? request.store?.name ?? t('common.na')} ·{' '}
                    {formatDateTime(request.requestTime)}
                  </Text>
                  <Text style={[styles.rowAmount, { color: colors.text }]}>
                    {formatMoney(request.requestAmount)}
                  </Text>
                  {pending ? (
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => settle(request, 'TRANSFERRED')}
                        style={[styles.actionBtn, { backgroundColor: colors.success }]}
                      >
                        <Text style={styles.actionLabel}>{t('wallet.approve')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => settle(request, 'CANCELLED')}
                        style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                      >
                        <Text style={styles.actionLabel}>{t('wallet.reject')}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Card>
              );
            })
          )
        ) : null}

        {tab === 'transactions' ? (
          transactionsQuery.loading && transactions.length === 0 ? (
            <SkeletonList rows={3} />
          ) : transactions.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t('wallet.noTransactions')}</Text>
          ) : (
            transactions.map((tx) => (
              <Card key={tx._id} style={styles.rowCard}>
                <View style={styles.rowHeader}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {tx.transactionId ?? tx._id.slice(-6)}
                  </Text>
                  <Text style={[styles.rowAmount, { color: colors.text }]}>
                    {formatMoney(tx.amountTransferred, tx.amountCurrency ?? 'SAR')}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {tx.userType ?? t('common.na')} · {formatDateTime(tx.createdAt)}
                </Text>
                <Badge label={tx.status ?? 'UNKNOWN'} tone={statusTone(tx.status)} />
              </Card>
            ))
          )
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 10 },
  title: { fontSize: 24, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  tabLabel: { fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCell: { flex: 1, gap: 2 },
  summaryLabel: { fontSize: 11 },
  summaryValue: { fontSize: 14, fontWeight: '800' },
  rowCard: { gap: 5 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowAmount: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 12 },
  muted: { fontSize: 13, paddingVertical: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  actionLabel: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
