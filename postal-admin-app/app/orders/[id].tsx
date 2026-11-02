import { useMutation, useQuery } from '@apollo/client';
import { ASSIGN_RIDER, ORDER_BY_ID, RIDERS, UPDATE_ORDER_STATUS } from '@/lib/graphql-docs';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
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
import { ORDER_STATUSES, type TOrderStatus } from '../../lib/config';
import type { IOrder, IRider } from '../../lib/interfaces';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { formatDateTime, formatMoney, statusTone } from '../../lib/utils/format';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { handleAuthError } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [riderPicker, setRiderPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useQuery<{ order: IOrder }>(ORDER_BY_ID, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
    pollInterval: 20_000,
    skip: !id,
  });

  const { data: ridersData } = useQuery<{ riders: IRider[] }>(RIDERS, {
    fetchPolicy: 'cache-and-network',
    skip: !riderPicker,
  });

  const [updateStatus] = useMutation(UPDATE_ORDER_STATUS);
  const [assignRider] = useMutation(ASSIGN_RIDER);

  const order = data?.order;

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

  const changeStatus = useCallback(
    (next: TOrderStatus) => {
      if (!order) return;
      Alert.alert(t('orders.changeStatus'), `${order.orderStatus} → ${next}`, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            setBusy(true);
            updateStatus({ variables: { id: order._id, orderStatus: next } })
              .then(() => {
                void refetch();
                Alert.alert(t('orders.updated'));
              })
              .catch((err: unknown) => {
                handleAuthError(err);
                Alert.alert(t('common.error'));
              })
              .finally(() => setBusy(false));
          },
        },
      ]);
    },
    [order, t, updateStatus, refetch, handleAuthError],
  );

  const assign = useCallback(
    (riderId: string) => {
      if (!order) return;
      setBusy(true);
      assignRider({ variables: { orderId: order._id, riderId } })
        .then(() => {
          setRiderPicker(false);
          void refetch();
          Alert.alert(t('orders.assigned'));
        })
        .catch((err: unknown) => {
          handleAuthError(err);
          Alert.alert(t('common.error'));
        })
        .finally(() => setBusy(false));
    },
    [order, assignRider, refetch, t, handleAuthError],
  );

  if (loading && !order) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <SkeletonList rows={4} />
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ErrorState
          message={t('common.error')}
          onRetry={() => void refetch()}
          retryLabel={t('common.retry')}
        />
      </SafeAreaView>
    );
  }

  const status = order.orderStatus ?? order.status ?? 'UNKNOWN';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]} numberOfLines={1}>
          #{order.orderId ?? order._id.slice(-6)}
        </Text>
        <Badge label={status} tone={statusTone(status)} />
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
          <SectionTitle>{t('orders.details')}</SectionTitle>
          <Row label={t('orders.customer')} value={order.user?.name ?? t('common.na')} />
          <Row label={t('more.phone')} value={order.user?.phone ?? t('common.na')} />
          <Row label={t('orders.store')} value={order.restaurant?.name ?? t('common.na')} />
          <Row label={t('orders.placedAt')} value={formatDateTime(order.createdAt)} />
          <Row label={t('orders.paymentMethod')} value={order.paymentMethod ?? t('common.na')} />
          <Row label={t('orders.paymentStatus')} value={order.paymentStatus ?? t('common.na')} />
          <Row label={t('orders.rider')} value={order.rider?.name ?? t('orders.noRider')} />
          <Row
            label={t('orders.address')}
            value={
              order.deliveryAddress?.deliveryAddress ??
              order.deliveryAddress?.details ??
              t('common.na')
            }
          />
        </Card>

        <Card>
          <SectionTitle>{t('orders.items')}</SectionTitle>
          {(order.items ?? []).length === 0 ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t('orders.noItems')}</Text>
          ) : (
            (order.items ?? []).map((item, index) => (
              <View key={item._id ?? String(index)} style={[styles.item, { borderTopColor: colors.border }]}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>
                    {item.quantity ?? 1}× {item.title ?? t('common.na')}
                  </Text>
                  <Text style={[styles.itemPrice, { color: colors.text }]}>
                    {formatMoney(item.variation?.price)}
                  </Text>
                </View>
                {item.variation?.title ? (
                  <Text style={[styles.muted, { color: colors.textMuted }]}>{item.variation.title}</Text>
                ) : null}
                {(item.addons ?? []).map((addon) => (
                  <Text key={addon._id ?? addon.title ?? ''} style={[styles.muted, { color: colors.textMuted }]}>
                    + {addon.title}
                    {addon.options?.length
                      ? `: ${addon.options.map((option) => option.title).filter(Boolean).join(', ')}`
                      : ''}
                  </Text>
                ))}
                {item.specialInstructions ? (
                  <Text style={[styles.note, { color: colors.warning }]}>{item.specialInstructions}</Text>
                ) : null}
              </View>
            ))
          )}
        </Card>

        <Card>
          <SectionTitle>{t('orders.total')}</SectionTitle>
          <Row label={t('orders.subtotal')} value={formatMoney(order.orderAmount)} />
          <Row label={t('orders.delivery')} value={formatMoney(order.deliveryCharges)} />
          <Row label={t('orders.tax')} value={formatMoney(order.taxationAmount)} />
          <Row label={t('orders.tip')} value={formatMoney(order.tipping)} />
          <Row label={t('orders.discount')} value={formatMoney(order.discount)} />
          <Row label={t('orders.total')} value={formatMoney(order.total)} strong />
          {order.instructions ? (
            <Text style={[styles.note, { color: colors.textMuted }]}>
              {t('orders.notes')}: {order.instructions}
            </Text>
          ) : null}
        </Card>

        <Card>
          <SectionTitle>{t('orders.changeStatus')}</SectionTitle>
          <View style={styles.statusGrid}>
            {ORDER_STATUSES.map((next) => {
              const active = next === status;
              return (
                <Pressable
                  key={next}
                  disabled={busy || active}
                  onPress={() => changeStatus(next)}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: active ? colors.primary : colors.surfaceMuted,
                      borderColor: active ? colors.primary : colors.border,
                      opacity: busy ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: active ? colors.primaryText : colors.text },
                    ]}
                  >
                    {next}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Button
          label={t('orders.assignRider')}
          onPress={() => setRiderPicker(true)}
          variant="secondary"
          disabled={busy}
        />
      </ScrollView>

      <Modal visible={riderPicker} transparent animationType="slide" onRequestClose={() => setRiderPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('orders.selectRider')}</Text>
            <ScrollView style={styles.riderList}>
              {(ridersData?.riders ?? []).map((rider) => (
                <Pressable
                  key={rider._id}
                  onPress={() => assign(rider._id)}
                  style={[styles.riderRow, { borderColor: colors.border }]}
                >
                  <View style={styles.riderInfo}>
                    <Text style={[styles.riderName, { color: colors.text }]}>{rider.name}</Text>
                    <Text style={[styles.muted, { color: colors.textMuted }]}>
                      {rider.phone ?? t('common.na')} · {rider.vehicleType ?? t('common.na')}
                    </Text>
                  </View>
                  <Badge
                    label={rider.available ? t('riders.available') : t('riders.busy')}
                    tone={rider.available ? 'success' : 'warning'}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <Button label={t('common.cancel')} onPress={() => setRiderPicker(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
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
  muted: { fontSize: 12 },
  item: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 4, gap: 2 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemTitle: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  itemPrice: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 12, fontStyle: 'italic' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    gap: 12,
    maxHeight: '75%',
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  riderList: { maxHeight: 360 },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  riderInfo: { flex: 1, gap: 2 },
  riderName: { fontSize: 14, fontWeight: '600' },
});
