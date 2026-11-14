import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { useApptheme } from "@/lib/context/theme.context";

export default function MenuItemLayout() {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: appTheme.themeBackground },
        headerTitleStyle: { color: appTheme.fontMainColor },
        headerTintColor: appTheme.fontMainColor,
        headerTitleAlign: "center",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: t("Add item") }} />
    </Stack>
  );
}
