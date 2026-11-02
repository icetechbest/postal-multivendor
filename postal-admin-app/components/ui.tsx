import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../lib/theme';

export const Screen = ({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }, style]}
    >
      <View style={[styles.fill, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
};

export const Card = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
};

type TButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: TButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) => {
  const { colors } = useTheme();
  const palette: Record<TButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    secondary: { bg: colors.surfaceMuted, fg: colors.text, border: colors.border },
    danger: { bg: colors.danger, fg: '#ffffff', border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary, border: colors.border },
  };
  const tone = palette[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tone.bg, borderColor: tone.border, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} />
      ) : (
        <Text style={[styles.buttonLabel, { color: tone.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
};

type TTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const Badge = ({ label, tone = 'neutral' }: { label: string; tone?: TTone }) => {
  const { colors } = useTheme();
  const tones: Record<TTone, string> = {
    neutral: colors.textMuted,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.primary,
  };
  return (
    <View style={[styles.badge, { borderColor: tones[tone] }]}>
      <Text style={[styles.badgeLabel, { color: tones[tone] }]}>{label}</Text>
    </View>
  );
};

export const TextField = ({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          style,
        ]}
        {...props}
      />
    </View>
  );
};

export const Skeleton = ({ height = 16, width = '100%' as const }: { height?: number; width?: number | `${number}%` }) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height,
        width,
        borderRadius: 8,
        backgroundColor: colors.surfaceMuted,
        opacity: 0.8,
      }}
    />
  );
};

export const SkeletonList = ({ rows = 5 }: { rows?: number }) => (
  <View style={styles.stack}>
    {Array.from({ length: rows }).map((_, index) => (
      <Card key={index} style={styles.skeletonCard}>
        <Skeleton height={18} width="55%" />
        <Skeleton height={14} width="80%" />
        <Skeleton height={14} width="40%" />
      </Card>
    ))}
  </View>
);

export const EmptyState = ({ title, hint }: { title: string; hint?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
};

export const ErrorState = ({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel: string;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.emptyTitle, { color: colors.danger }]}>{message}</Text>
      {onRetry ? (
        <Button label={retryLabel} onPress={onRetry} variant="secondary" style={styles.retry} />
      ) : null}
    </View>
  );
};

export const ListFooter = ({ loading }: { loading: boolean }) => {
  const { colors } = useTheme();
  if (!loading) return null;
  return (
    <View style={styles.footer}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
};

export const Row = ({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text, fontWeight: strong ? '700' : '500' }]}>
        {value}
      </Text>
    </View>
  );
};

export const SectionTitle = ({ children }: { children: ReactNode }) => {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>;
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  padded: { paddingHorizontal: 16, paddingTop: 12 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  button: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  stack: { gap: 10 },
  skeletonCard: { gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  retry: { marginTop: 8, minWidth: 120 },
  footer: { paddingVertical: 18, alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 13, flexShrink: 1 },
  rowValue: { fontSize: 13, flexShrink: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
});
