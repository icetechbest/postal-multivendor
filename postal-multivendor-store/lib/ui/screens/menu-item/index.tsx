import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@apollo/client";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";

import { SUB_CATEGORIES_BY_PARENT } from "@/lib/apollo/queries/menu.query";
import { useApptheme } from "@/lib/context/theme.context";
import useImageUpload from "@/lib/hooks/useImageUpload";
import useMenu from "@/lib/hooks/useMenu";
import {
  IFoodFormValues,
  IMenuSubCategory,
  IMenuVariation,
} from "@/lib/utils/interfaces/menu.interface";
import { CategorySheet } from "../../screen-components/menu/sheets";
import {
  Chip,
  EmptyState,
  Field,
  ImageField,
  parseNumber,
  PrimaryButton,
  SecondaryButton,
  SwitchRow,
} from "../../screen-components/menu/ui";

const emptyVariation = (title = ""): IMenuVariation & { _key: string } => ({
  _key: Math.random().toString(36).slice(2),
  title,
  price: 0,
  discounted: 0,
  isOutOfStock: false,
  addons: [],
});

type FormVariation = IMenuVariation & { _key: string; priceText: string; discountText: string };

const toForm = (variation: IMenuVariation & { _key?: string }): FormVariation => ({
  ...variation,
  _key: variation._key ?? Math.random().toString(36).slice(2),
  priceText: variation.price ? String(variation.price) : "",
  discountText: variation.discounted ? String(variation.discounted) : "",
});

export default function MenuItemScreen() {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const navigation = useNavigation();
  const { id, categoryId } = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const menu = useMenu();
  const { uploading, chooseAndUpload } = useImageUpload();

  const editing = useMemo(() => menu.foods.find((f) => f._id === id) ?? null, [menu.foods, id]);
  const isEdit = Boolean(id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [category, setCategory] = useState<string>(categoryId ?? "");
  const [subCategory, setSubCategory] = useState("");
  const [variations, setVariations] = useState<FormVariation[]>([toForm(emptyVariation(""))]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const [pendingCategoryTitle, setPendingCategoryTitle] = useState("");

  // Auto-select a category that was just created from this screen.
  useEffect(() => {
    if (!pendingCategoryTitle) return;
    const created = menu.categories.find((c) => c.title === pendingCategoryTitle);
    if (created) {
      setCategory(created._id);
      setSubCategory("");
      setPendingCategoryTitle("");
    }
  }, [menu.categories, pendingCategoryTitle]);

  // Fill the form once the item is available (edit mode).
  useEffect(() => {
    if (loaded) return;
    if (isEdit) {
      if (!editing) return;
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setImage(editing.image ?? "");
      setCategory(editing.categoryId);
      setSubCategory(editing.subCategory ?? "");
      setVariations(editing.variations.map(toForm));
    }
    setLoaded(true);
  }, [editing, isEdit, loaded]);

  useEffect(() => {
    navigation.setOptions?.({ title: isEdit ? t("Edit item") : t("Add item") });
  }, [navigation, isEdit, t]);

  const { data: subData } = useQuery<{ subCategoriesByParentId: IMenuSubCategory[] }>(
    SUB_CATEGORIES_BY_PARENT,
    { variables: { parentCategoryId: category }, skip: !category, fetchPolicy: "cache-and-network" },
  );
  const subCategories = subData?.subCategoriesByParentId ?? [];

  const updateVariation = (key: string, patch: Partial<FormVariation>) =>
    setVariations((prev) => prev.map((v) => (v._key === key ? { ...v, ...patch } : v)));

  const removeVariation = (key: string) =>
    setVariations((prev) => (prev.length > 1 ? prev.filter((v) => v._key !== key) : prev));

  const toggleAddon = (key: string, addonId: string) =>
    setVariations((prev) =>
      prev.map((v) =>
        v._key !== key
          ? v
          : {
              ...v,
              addons: v.addons.includes(addonId)
                ? v.addons.filter((a) => a !== addonId)
                : [...v.addons, addonId],
            },
      ),
    );

  const validate = (): IFoodFormValues | null => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t("Item name is required");
    if (!image) next.image = t("A picture is required");
    if (!category) next.category = t("Choose a category");

    const parsed: IMenuVariation[] = [];
    variations.forEach((variation, index) => {
      const price = parseNumber(variation.priceText);
      const discounted = variation.discountText.trim() ? parseNumber(variation.discountText) : 0;
      if (variations.length > 1 && !variation.title.trim()) {
        next[`v${index}title`] = t("Size name is required");
      }
      if (!Number.isFinite(price) || price < 0) {
        next[`v${index}price`] = t("Enter a valid price");
      }
      if (!Number.isFinite(discounted) || discounted < 0 || (Number.isFinite(price) && discounted > 0 && discounted >= price)) {
        next[`v${index}discount`] = t("Discounted price must be lower than the price");
      }
      parsed.push({
        _id: variation._id,
        title: variation.title.trim() || title.trim(),
        price,
        discounted: Number.isFinite(discounted) ? discounted : 0,
        isOutOfStock: variation.isOutOfStock,
        addons: variation.addons,
      });
    });

    setErrors(next);
    if (Object.keys(next).length) return null;
    return {
      _id: editing?._id,
      title,
      description,
      image,
      category,
      subCategory,
      variations: parsed,
    };
  };

  const reset = () => {
    setTitle("");
    setDescription("");
    setImage("");
    setSubCategory("");
    setVariations([toForm(emptyVariation(""))]);
    setErrors({});
  };

  const save = async (addAnother = false) => {
    const values = validate();
    if (!values) return;
    setSaving(true);
    const ok = isEdit ? await menu.editFood(values) : await menu.createFood(values);
    setSaving(false);
    if (!ok) return;
    if (addAnother) {
      reset();
    } else {
      router.back();
    }
  };

  const remove = () =>
    Alert.alert(t("Delete item"), t("Delete \"{{name}}\" from your menu?", { name: title }), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: async () => {
          if (!editing) return;
          setSaving(true);
          const ok = await menu.deleteFood(editing._id);
          setSaving(false);
          if (ok) router.back();
        },
      },
    ]);

  if (isEdit && !editing) {
    return (
      <View className="flex-1" style={{ backgroundColor: appTheme.themeBackground }}>
        <EmptyState
          icon={menu.loading ? "hourglass-outline" : "alert-circle-outline"}
          title={menu.loading ? t("Loading your menu…") : t("This item no longer exists")}
          action={menu.loading ? undefined : <PrimaryButton title={t("Back")} onPress={() => router.back()} />}
        />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: appTheme.themeBackground }}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <ImageField
          label={t("Item picture")}
          uri={image}
          loading={uploading}
          error={errors.image}
          onPress={async () => {
            const url = await chooseAndUpload();
            if (url) setImage(url);
          }}
          onRemove={() => setImage("")}
        />

        <Field
          label={t("Item name")}
          value={title}
          onChangeText={setTitle}
          placeholder={t("e.g. Cheeseburger")}
          error={errors.title}
        />
        <Field
          label={t("Description (optional)")}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {/* Category */}
        <Text className="mb-2 font-semibold" style={{ color: appTheme.fontMainColor }}>
          {t("Category")}
        </Text>
        <View className="flex-row flex-wrap">
          {menu.categories.map((c) => (
            <Chip
              key={c._id}
              label={c.title}
              selected={category === c._id}
              onPress={() => {
                setCategory(c._id);
                setSubCategory("");
              }}
            />
          ))}
          <TouchableOpacity
            onPress={() => setCategorySheet(true)}
            className="mb-2 mr-2 flex-row items-center gap-1 rounded-full border border-dashed px-4 py-2"
            style={{ borderColor: appTheme.borderLineColor }}
          >
            <Ionicons name="add" size={16} color={appTheme.fontMainColor} />
            <Text style={{ color: appTheme.fontMainColor }}>{t("New category")}</Text>
          </TouchableOpacity>
        </View>
        {errors.category ? (
          <Text className="mb-3 text-xs" style={{ color: appTheme.error }}>
            {errors.category}
          </Text>
        ) : null}

        {subCategories.length ? (
          <View className="mt-2">
            <Text className="mb-2 font-semibold" style={{ color: appTheme.fontMainColor }}>
              {t("Sub-category (optional)")}
            </Text>
            <View className="flex-row flex-wrap">
              <Chip label={t("None")} selected={!subCategory} onPress={() => setSubCategory("")} />
              {subCategories.map((s) => (
                <Chip
                  key={s._id}
                  label={s.title}
                  selected={subCategory === s.title}
                  onPress={() => setSubCategory(s.title)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Variations */}
        <Text className="mb-1 mt-4 text-base font-bold" style={{ color: appTheme.fontMainColor }}>
          {t("Prices & sizes")}
        </Text>
        <Text className="mb-3 text-xs" style={{ color: appTheme.fontSecondColor }}>
          {t("Add one price, or several sizes like Small / Medium / Large.")}
        </Text>

        {variations.map((variation, index) => (
          <View
            key={variation._key}
            className="mb-4 rounded-2xl border p-3"
            style={{ borderColor: appTheme.borderLineColor, backgroundColor: appTheme.cartContainer }}
          >
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-semibold" style={{ color: appTheme.fontMainColor }}>
                {variations.length > 1 ? `${t("Size")} ${index + 1}` : t("Price")}
              </Text>
              {variations.length > 1 ? (
                <TouchableOpacity onPress={() => removeVariation(variation._key)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={appTheme.error} />
                </TouchableOpacity>
              ) : null}
            </View>

            {variations.length > 1 || variation.title ? (
              <Field
                label={t("Size name")}
                value={variation.title}
                onChangeText={(value) => updateVariation(variation._key, { title: value })}
                placeholder={t("e.g. Large")}
                error={errors[`v${index}title`]}
              />
            ) : null}

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field
                  label={t("Price")}
                  value={variation.priceText}
                  onChangeText={(value) => updateVariation(variation._key, { priceText: value })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  error={errors[`v${index}price`]}
                />
              </View>
              <View className="flex-1">
                <Field
                  label={t("Discounted price")}
                  value={variation.discountText}
                  onChangeText={(value) => updateVariation(variation._key, { discountText: value })}
                  keyboardType="decimal-pad"
                  placeholder={t("Optional")}
                  error={errors[`v${index}discount`]}
                />
              </View>
            </View>

            <SwitchRow
              label={t("Out of stock")}
              value={variation.isOutOfStock}
              onChange={(value) => updateVariation(variation._key, { isOutOfStock: value })}
            />

            {menu.addons.length ? (
              <View className="mt-3">
                <Text className="mb-2 font-semibold" style={{ color: appTheme.fontMainColor }}>
                  {t("Add-ons for this price")}
                </Text>
                <View className="flex-row flex-wrap">
                  {menu.addons.map((addon) => (
                    <Chip
                      key={addon._id}
                      label={addon.title}
                      selected={variation.addons.includes(addon._id)}
                      onPress={() => toggleAddon(variation._key, addon._id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ))}

        <SecondaryButton
          title={t("Add another size")}
          icon="add"
          onPress={() => setVariations((prev) => [...prev, toForm(emptyVariation(""))])}
        />

        <View className="mt-6">
          <PrimaryButton
            title={isEdit ? t("Save changes") : t("Save item")}
            onPress={() => save(false)}
            loading={saving}
          />
        </View>
        {!isEdit ? (
          <View className="mt-3">
            <SecondaryButton title={t("Save and add another")} icon="add-circle-outline" onPress={() => save(true)} />
          </View>
        ) : (
          <View className="mt-3">
            <SecondaryButton title={t("Delete item")} icon="trash-outline" danger onPress={remove} />
          </View>
        )}
      </ScrollView>

      <CategorySheet
        visible={categorySheet}
        category={null}
        menu={menu}
        onClose={() => setCategorySheet(false)}
        onSaved={setPendingCategoryTitle}
      />
    </View>
  );
}
