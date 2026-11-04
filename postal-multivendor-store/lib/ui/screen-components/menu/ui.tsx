import { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useApptheme } from "@/lib/context/theme.context";

/** Text field with a label and optional inline error. */
export function Field({
  label,
  error,
  hint,
  ...props
}: { label: string; error?: string; hint?: string } & TextInputProps) {
  const { appTheme } = useApptheme();
  return (
    <View className="mb-4">
      <Text className="mb-1 font-semibold" style={{ color: appTheme.fontMainColor }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={appTheme.fontSecondColor}
        {...props}
        className="rounded-xl border px-3 py-3"
        style={[
          {
            color: appTheme.fontMainColor,
            borderColor: error ? appTheme.error : appTheme.borderLineColor,
            backgroundColor: appTheme.cartContainer,
            textAlignVertical: props.multiline ? "top" : "center",
            minHeight: props.multiline ? 80 : undefined,
          },
          props.style,
        ]}
      />
      {hint && !error ? (
        <Text className="mt-1 text-xs" style={{ color: appTheme.fontSecondColor }}>
          {hint}
        </Text>
      ) : null}
      {error ? (
        <Text className="mt-1 text-xs" style={{ color: appTheme.error }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { appTheme } = useApptheme();
  const inactive = loading || disabled;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
      className="flex-row items-center justify-center gap-2 rounded-full py-4"
      style={{ backgroundColor: appTheme.primary, opacity: inactive ? 0.6 : 1 }}
    >
      {loading ? (
        <ActivityIndicator color={appTheme.black} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={appTheme.black} /> : null}
          <Text className="font-semibold" style={{ color: appTheme.black }}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  title,
  onPress,
  danger,
  icon,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { appTheme } = useApptheme();
  const color = danger ? appTheme.error : appTheme.fontMainColor;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center justify-center gap-2 rounded-full border py-3"
      style={{ borderColor: danger ? appTheme.error : appTheme.borderLineColor }}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text className="font-semibold" style={{ color }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

/** Small round icon button used on cards. */
export function IconButton({
  name,
  onPress,
  danger,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
}) {
  const { appTheme } = useApptheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={8}
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{ backgroundColor: appTheme.sidebarIconBackground }}
    >
      <Ionicons name={name} size={18} color={danger ? appTheme.error : "#333333"} />
    </TouchableOpacity>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { appTheme } = useApptheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="mb-2 mr-2 rounded-full border px-4 py-2"
      style={{
        backgroundColor: selected ? appTheme.primary : "transparent",
        borderColor: selected ? appTheme.primary : appTheme.borderLineColor,
      }}
    >
      <Text style={{ color: selected ? appTheme.black : appTheme.fontMainColor }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { appTheme } = useApptheme();
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text style={{ color: appTheme.fontMainColor }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: appTheme.primary, false: appTheme.gray }}
      />
    </View>
  );
}

/** Image box: tap to add/replace, with a remove button once set. */
export function ImageField({
  uri,
  onPress,
  onRemove,
  loading,
  label,
  error,
}: {
  uri?: string | null;
  onPress: () => void;
  onRemove?: () => void;
  loading?: boolean;
  label: string;
  error?: string;
}) {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  return (
    <View className="mb-4">
      <Text className="mb-1 font-semibold" style={{ color: appTheme.fontMainColor }}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="h-44 items-center justify-center overflow-hidden rounded-xl border border-dashed"
        style={{
          borderColor: error ? appTheme.error : appTheme.borderLineColor,
          backgroundColor: appTheme.cartContainer,
        }}
      >
        {loading ? (
          <ActivityIndicator color={appTheme.primary} />
        ) : uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View className="items-center gap-1">
            <Ionicons name="camera-outline" size={32} color={appTheme.fontSecondColor} />
            <Text style={{ color: appTheme.fontSecondColor }}>{t("Tap to add a picture")}</Text>
          </View>
        )}
      </TouchableOpacity>
      {uri && onRemove && !loading ? (
        <TouchableOpacity onPress={onRemove} className="mt-2 self-start">
          <Text style={{ color: appTheme.error }}>{t("Remove picture")}</Text>
        </TouchableOpacity>
      ) : null}
      {error ? (
        <Text className="mt-1 text-xs" style={{ color: appTheme.error }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Bottom-sheet style modal that scrolls and avoids the keyboard. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { appTheme } = useApptheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="max-h-[90%] rounded-t-3xl px-5 pb-6 pt-4"
          style={{ backgroundColor: appTheme.themeBackground }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold" style={{ color: appTheme.fontMainColor }}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={appTheme.fontMainColor} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { appTheme } = useApptheme();
  return (
    <View className="items-center px-8 py-16">
      <Ionicons name={icon} size={56} color={appTheme.fontSecondColor} />
      <Text className="mt-3 text-center text-base font-bold" style={{ color: appTheme.fontMainColor }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-center" style={{ color: appTheme.fontSecondColor }}>
          {subtitle}
        </Text>
      ) : null}
      {action ? <View className="mt-5 w-full">{action}</View> : null}
    </View>
  );
}

/** Parses "12", "12.5" or "12,5" (Arabic keyboards) into a number; NaN when invalid. */
export const parseNumber = (value: string): number => {
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace("٫", ".")
    .replace(",", ".")
    .trim();
  return normalized === "" ? NaN : Number(normalized);
};
