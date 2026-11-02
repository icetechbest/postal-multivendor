import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IOrder } from '../lib/interfaces';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { formatDateTime, formatMoney, statusTone } from '../lib/utils/format';
import { Badge } from './ui';

export const OrderRow = ({ order, onPress }: { order: IOrder; onPress: () => void }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const status = order.orderStatus ?? order.status ?? 'UNKNOWN';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.orderId, { color: colors.text }]}>#{order.orderId ?? order._id.slice(-6)}</Text>
        <Badge label={status} tone={statusTone(status)} />
      </View>

      <Text style={[styles.customer, { color: colors.text }]} numberOfLines={1}>
        {order.user?.name ?? t('common.na')}
        {order.user?.phone ? ` · ${order.user.phone}` : ''}
      </Text>
      <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
        {order.restaurant?.name ?? t('common.na')} · {formatDateTime(order.createdAt)}
      </Text>

      <View style={styles.footer}>
        <Text style={[styles.payment, { color: colors.textMuted }]}>
          {order.paymentMethod ?? t('common.na')} · {order.paymentStatus ?? t('common.na')}
        </Text>
        <Text style={[styles.total, { color: colors.primary }]}>
          {formatMoney(order.total ?? order.orderAmount)}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 5,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId: { fontSize: 15, fontWeight: '800' },
  customer: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  payment: { fontSize: 11, flexShrink: 1 },
  total: { fontSize: 15, fontWeight: '800' },
});
