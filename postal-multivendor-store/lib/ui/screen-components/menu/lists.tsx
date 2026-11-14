import { useMemo, useState } from "react";
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import i18next from "i18next";
import { useTranslation } from "react-i18next";

import { useApptheme } from "@/lib/context/theme.context";
import useMenu, {
  addonOptionIds,
  isFoodAvailable,
  priceRange,
} from "@/lib/hooks/useMenu";
import {
  IMenuAddon,
  IMenuCategory,
  IMenuFoodWithCategory,
  IMenuOption,
} from "@/lib/utils/interfaces/menu.interface";
import { Chip, EmptyState, IconButton, PrimaryButton, SwitchRow } from "./ui";

type Menu = ReturnType<typeof useMenu>;

const confirmDelete = (
  title: string,
  message: string,
  deleteLabel: string,
  onConfirm: () => void,
  cancelLabel = i18next.t("Cancel"),
) =>
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: deleteLabel, style: "destructive", onPress: onConfirm },
  ]);

const money = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

// ───────────────────────────── Items ─────────────────────────────
export function ItemsTab({
  menu,
  onAddCategory,
}: {
  menu: Menu;
  onAddCategory: () => void;
}) {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.foods.filter(
      (food) =>
        (categoryId === "all" || food.categoryId === categoryId) &&
        (!q || food.title.toLowerCase().includes(q) || food.description?.toLowerCase().includes(q)),
    );
  }, [menu.foods, search, categoryId]);

  const addItem = () => {
    if (!menu.categories.length) {
      Alert.alert(t("Create a category first"), t("Items live inside categories. Add your first category to start."), [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Add category"), onPress: onAddCategory },
      ]);
      return;
    }
    router.push({
      pathname: "/(protected)/menu-item",
      params: categoryId !== "all" ? { categoryId } : {},
    });
  };

  const toggle = async (food: IMenuFoodWithCategory, available: boolean) => {
    setBusyId(food._id);
    await menu.setFoodAvailability(food._id, available);
    setBusyId(null);
  };

  const remove = (food: IMenuFoodWithCategory) =>
    confirmDelete(t("Delete item"), t("Delete \"{{name}}\" from your menu?", { name: food.title }), t("Delete"), async () => {
      setBusyId(food._id);
      await menu.deleteFood(food._id);
      setBusyId(null);
    });

  const duplicate = async (food: IMenuFoodWithCategory) => {
    setBusyId(food._id);
    await menu.createFood({
      title: `${food.title} (${t("copy")})`,
      description: food.description,
      image: food.image,
      category: food.categoryId,
      subCategory: food.subCategory ?? "",
      variations: food.variations.map(({ _id, ...variation }) => ({ ...variation })),
    });
    setBusyId(null);
  };

  return (
    <View className="flex-1">
      <View className="px-4 pt-3">
        <View
          className="flex-row items-center rounded-full border px-4"
          style={{ borderColor: appTheme.borderLineColor, backgroundColor: appTheme.cartContainer }}
        >
          <Ionicons name="search" size={18} color={appTheme.fontSecondColor} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("Search items")}
            placeholderTextColor={appTheme.fontSecondColor}
            className="flex-1 px-2 py-3"
            style={{ color: appTheme.fontMainColor }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={appTheme.fontSecondColor} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View className="mt-3 flex-row flex-wrap">
          <Chip label={t("All")} selected={categoryId === "all"} onPress={() => setCategoryId("all")} />
          {menu.categories.map((category) => (
            <Chip
              key={category._id}
              label={category.title}
              selected={categoryId === category._id}
              onPress={() => setCategoryId(category._id)}
            />
          ))}
        </View>
      </View>

      {visible.length === 0 ? (
        <EmptyState
          icon="fast-food-outline"
          title={menu.foods.length ? t("No items match your search") : t("Your menu is empty")}
          subtitle={menu.foods.length ? undefined : t("Add your first item so customers can order it.")}
          action={menu.foods.length ? undefined : <PrimaryButton title={t("Add item")} icon="add" onPress={addItem} />}
        />
      ) : (
        <View className="px-4 pb-4">
          {visible.map((food) => {
            const { min, max } = priceRange(food);
            const available = isFoodAvailable(food);
            return (
              <TouchableOpacity
                key={food._id}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/(protected)/menu-item", params: { id: food._id } })}
                className="mb-3 overflow-hidden rounded-2xl border"
                style={{
                  borderColor: appTheme.borderLineColor,
                  backgroundColor: appTheme.cartContainer,
                  opacity: busyId === food._id ? 0.5 : 1,
                }}
              >
                <View className="flex-row">
                  {food.image ? (
                    <Image source={{ uri: food.image }} style={{ width: 96, height: 96 }} />
                  ) : (
                    <View
                      className="items-center justify-center"
                      style={{ width: 96, height: 96, backgroundColor: appTheme.gray }}
                    >
                      <Ionicons name="image-outline" size={28} color={appTheme.fontSecondColor} />
                    </View>
                  )}
                  <View className="flex-1 justify-between p-3">
                    <View>
                      <Text className="font-bold" numberOfLines={1} style={{ color: appTheme.fontMainColor }}>
                        {food.title}
                      </Text>
                      <Text className="text-xs" numberOfLines={1} style={{ color: appTheme.fontSecondColor }}>
                        {food.categoryTitle}
                        {food.subCategory ? ` • ${food.subCategory}` : ""}
                      </Text>
                    </View>
                    <Text className="font-semibold" style={{ color: appTheme.fontMainColor }}>
                      {min === max ? money(min) : `${money(min)} – ${money(max)}`}
                      <Text className="text-xs font-normal" style={{ color: appTheme.fontSecondColor }}>
                        {food.variations.length > 1 ? `  • ${food.variations.length} ${t("sizes")}` : ""}
                      </Text>
                    </Text>
                  </View>
                </View>
                <View
                  className="flex-row items-center justify-between border-t px-3 py-2"
                  style={{ borderColor: appTheme.borderLineColor }}
                >
                  <View className="flex-1 pr-2">
                    <SwitchRow
                      label={available ? t("Available") : t("Out of stock")}
                      value={available}
                      onChange={(value) => toggle(food, value)}
                      disabled={busyId === food._id}
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <IconButton name="copy-outline" onPress={() => duplicate(food)} />
                    <IconButton
                      name="create-outline"
                      onPress={() => router.push({ pathname: "/(protected)/menu-item", params: { id: food._id } })}
                    />
                    <IconButton name="trash-outline" danger onPress={() => remove(food)} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ───────────────────────────── Categories ─────────────────────────────
export function CategoriesTab({
  menu,
  onEdit,
  onAdd,
}: {
  menu: Menu;
  onEdit: (category: IMenuCategory) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!menu.categories.length) {
    return (
      <EmptyState
        icon="albums-outline"
        title={t("No categories yet")}
        subtitle={t("Categories group your items, like Burgers or Drinks.")}
        action={<PrimaryButton title={t("Add category")} icon="add" onPress={onAdd} />}
      />
    );
  }

  const remove = (category: IMenuCategory) =>
    confirmDelete(
      t("Delete category"),
      t("Delete \"{{name}}\"? Its {{count}} item(s) will be removed from your menu too.", {
        name: category.title,
        count: category.foods.length,
      }),
      t("Delete"),
      async () => {
        setBusyId(category._id);
        await menu.deleteCategory(category._id);
        setBusyId(null);
      },
    );

  return (
    <View className="px-4 pb-4 pt-3">
      {menu.categories.map((category) => (
        <View
          key={category._id}
          className="mb-3 flex-row items-center rounded-2xl border p-3"
          style={{
            borderColor: appTheme.borderLineColor,
            backgroundColor: appTheme.cartContainer,
            opacity: busyId === category._id ? 0.5 : 1,
          }}
        >
          {category.image ? (
            <Image source={{ uri: category.image }} style={{ width: 56, height: 56, borderRadius: 12 }} />
          ) : (
            <View
              className="items-center justify-center rounded-xl"
              style={{ width: 56, height: 56, backgroundColor: appTheme.gray }}
            >
              <Ionicons name="albums-outline" size={24} color={appTheme.fontSecondColor} />
            </View>
          )}
          <View className="mx-3 flex-1">
            <Text className="font-bold" numberOfLines={1} style={{ color: appTheme.fontMainColor }}>
              {category.title}
            </Text>
            <Text className="text-xs" style={{ color: appTheme.fontSecondColor }}>
              {t("{{count}} items", { count: category.foods.length })}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <IconButton name="create-outline" onPress={() => onEdit(category)} />
            <IconButton name="trash-outline" danger onPress={() => remove(category)} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────────── Add-ons ─────────────────────────────
export function AddonsTab({
  menu,
  onEdit,
  onAdd,
}: {
  menu: Menu;
  onEdit: (addon: IMenuAddon) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!menu.addons.length) {
    return (
      <EmptyState
        icon="layers-outline"
        title={t("No add-ons yet")}
        subtitle={t("Add-ons are groups of choices customers can add to an item, like sauces or toppings.")}
        action={<PrimaryButton title={t("Add add-on")} icon="add" onPress={onAdd} />}
      />
    );
  }

  const optionTitle = (id: string) => menu.options.find((o) => o._id === id)?.title;

  const remove = (addon: IMenuAddon) =>
    confirmDelete(
      t("Delete add-on"),
      t("Delete \"{{name}}\"? It will be removed from every item using it.", { name: addon.title }),
      t("Delete"),
      async () => {
        setBusyId(addon._id);
        await menu.deleteAddon(addon._id);
        setBusyId(null);
      },
    );

  return (
    <View className="px-4 pb-4 pt-3">
      {menu.addons.map((addon) => {
        const names = addonOptionIds(addon).map(optionTitle).filter(Boolean) as string[];
        return (
          <View
            key={addon._id}
            className="mb-3 rounded-2xl border p-3"
            style={{
              borderColor: appTheme.borderLineColor,
              backgroundColor: appTheme.cartContainer,
              opacity: busyId === addon._id ? 0.5 : 1,
            }}
          >
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="font-bold" style={{ color: appTheme.fontMainColor }}>
                  {addon.title}
                </Text>
                <Text className="text-xs" style={{ color: appTheme.fontSecondColor }}>
                  {t("Choose {{min}} to {{max}}", { min: addon.quantityMinimum, max: addon.quantityMaximum })}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <IconButton name="create-outline" onPress={() => onEdit(addon)} />
                <IconButton name="trash-outline" danger onPress={() => remove(addon)} />
              </View>
            </View>
            {names.length ? (
              <Text className="mt-2" numberOfLines={2} style={{ color: appTheme.fontSecondColor }}>
                {names.join(" • ")}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ───────────────────────────── Options ─────────────────────────────
export function OptionsTab({
  menu,
  onEdit,
  onAdd,
}: {
  menu: Menu;
  onEdit: (option: IMenuOption) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!menu.options.length) {
    return (
      <EmptyState
        icon="pricetag-outline"
        title={t("No options yet")}
        subtitle={t("Options are the individual choices inside an add-on, like Ketchup or Extra cheese.")}
        action={<PrimaryButton title={t("Add option")} icon="add" onPress={onAdd} />}
      />
    );
  }

  const remove = (option: IMenuOption) =>
    confirmDelete(
      t("Delete option"),
      t("Delete \"{{name}}\"? It will be removed from every add-on using it.", { name: option.title }),
      t("Delete"),
      async () => {
        setBusyId(option._id);
        await menu.deleteOption(option._id);
        setBusyId(null);
      },
    );

  return (
    <View className="px-4 pb-4 pt-3">
      {menu.options.map((option) => (
        <View
          key={option._id}
          className="mb-3 flex-row items-center rounded-2xl border p-3"
          style={{
            borderColor: appTheme.borderLineColor,
            backgroundColor: appTheme.cartContainer,
            opacity: busyId === option._id ? 0.5 : 1,
          }}
        >
          <View className="flex-1">
            <Text className="font-bold" style={{ color: appTheme.fontMainColor }}>
              {option.title}
            </Text>
            {option.description ? (
              <Text className="text-xs" numberOfLines={1} style={{ color: appTheme.fontSecondColor }}>
                {option.description}
              </Text>
            ) : null}
          </View>
          <Text className="mx-3 font-semibold" style={{ color: appTheme.fontMainColor }}>
            {money(option.price)}
          </Text>
          <View className="flex-row gap-2">
            <IconButton name="create-outline" onPress={() => onEdit(option)} />
            <IconButton name="trash-outline" danger onPress={() => remove(option)} />
          </View>
        </View>
      ))}
    </View>
  );
}
