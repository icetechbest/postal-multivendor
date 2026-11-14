import { useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { useApptheme } from "@/lib/context/theme.context";
import useMenu from "@/lib/hooks/useMenu";
import {
  IMenuAddon,
  IMenuCategory,
  IMenuOption,
} from "@/lib/utils/interfaces/menu.interface";
import { AddonsTab, CategoriesTab, ItemsTab, OptionsTab } from "../../screen-components/menu/lists";
import { AddonSheet, CategorySheet, OptionSheet } from "../../screen-components/menu/sheets";
import { EmptyState, PrimaryButton } from "../../screen-components/menu/ui";

type TabKey = "items" | "categories" | "addons" | "options";

export default function MenuScreen() {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const menu = useMenu();

  const [tab, setTab] = useState<TabKey>("items");
  const [categorySheet, setCategorySheet] = useState<{ open: boolean; value: IMenuCategory | null }>({ open: false, value: null });
  const [addonSheet, setAddonSheet] = useState<{ open: boolean; value: IMenuAddon | null }>({ open: false, value: null });
  const [optionSheet, setOptionSheet] = useState<{ open: boolean; value: IMenuOption | null }>({ open: false, value: null });

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "items", label: t("Items"), count: menu.foods.length },
    { key: "categories", label: t("Categories"), count: menu.categories.length },
    { key: "addons", label: t("Add-ons"), count: menu.addons.length },
    { key: "options", label: t("Options"), count: menu.options.length },
  ];

  const openCategory = (value: IMenuCategory | null = null) => setCategorySheet({ open: true, value });
  const openAddon = (value: IMenuAddon | null = null) => setAddonSheet({ open: true, value });
  const openOption = (value: IMenuOption | null = null) => setOptionSheet({ open: true, value });

  const onFabPress = () => {
    if (tab === "categories") return openCategory();
    if (tab === "addons") return openAddon();
    if (tab === "options") return openOption();
    if (!menu.categories.length) {
      return Alert.alert(
        t("Create a category first"),
        t("Items live inside categories. Add your first category to start."),
        [
          { text: t("Cancel"), style: "cancel" },
          { text: t("Add category"), onPress: () => openCategory() },
        ],
      );
    }
    router.push("/(protected)/menu-item");
  };

  return (
    <View className="flex-1" style={{ backgroundColor: appTheme.themeBackground }}>
      {/* Segmented tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="grow-0"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
      >
        {tabs.map(({ key, label, count }) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              activeOpacity={0.8}
              className="mr-2 flex-row items-center gap-2 rounded-full px-4 py-2"
              style={{
                backgroundColor: active ? appTheme.primary : appTheme.sidebarIconBackground,
              }}
            >
              <Text className="font-semibold" style={{ color: active ? appTheme.black : "#333333" }}>
                {label}
              </Text>
              <View
                className="min-w-[22px] items-center rounded-full px-1.5"
                style={{ backgroundColor: active ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.08)" }}
              >
                <Text className="text-xs" style={{ color: active ? appTheme.black : "#333333" }}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {menu.loading ? (
        <EmptyState icon="hourglass-outline" title={t("Loading your menu…")} />
      ) : menu.error && !menu.restaurant ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("Could not load your menu")}
          subtitle={t("Check your connection and try again.")}
          action={<PrimaryButton title={t("Retry")} onPress={() => menu.refetch()} />}
        />
      ) : (
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 160 }}
          refreshControl={
            <RefreshControl
              refreshing={menu.refreshing}
              onRefresh={() => menu.refetch()}
              tintColor={appTheme.primary}
            />
          }
        >
          {tab === "items" && <ItemsTab menu={menu} onAddCategory={() => openCategory()} />}
          {tab === "categories" && (
            <CategoriesTab menu={menu} onEdit={openCategory} onAdd={() => openCategory()} />
          )}
          {tab === "addons" && <AddonsTab menu={menu} onEdit={openAddon} onAdd={() => openAddon()} />}
          {tab === "options" && <OptionsTab menu={menu} onEdit={openOption} onAdd={() => openOption()} />}
        </ScrollView>
      )}

      {/* Floating add button (sits above the tab bar) */}
      {!menu.loading ? (
        <TouchableOpacity
          onPress={onFabPress}
          activeOpacity={0.85}
          accessibilityLabel={t("Add")}
          className="absolute h-14 w-14 items-center justify-center rounded-full"
          style={{
            right: 20,
            bottom: 90,
            backgroundColor: appTheme.primary,
            elevation: 6,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <Ionicons name="add" size={30} color={appTheme.black} />
        </TouchableOpacity>
      ) : null}

      <CategorySheet
        visible={categorySheet.open}
        category={categorySheet.value}
        menu={menu}
        onClose={() => setCategorySheet((s) => ({ ...s, open: false }))}
      />
      <AddonSheet
        visible={addonSheet.open}
        addon={addonSheet.value}
        menu={menu}
        onClose={() => setAddonSheet((s) => ({ ...s, open: false }))}
        onCreateOption={() => {
          setTab("options");
          openOption();
        }}
      />
      <OptionSheet
        visible={optionSheet.open}
        option={optionSheet.value}
        menu={menu}
        onClose={() => setOptionSheet((s) => ({ ...s, open: false }))}
      />
    </View>
  );
}
