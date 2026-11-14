import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@apollo/client";
import { useTranslation } from "react-i18next";

import { SUB_CATEGORIES_BY_PARENT } from "@/lib/apollo/queries/menu.query";
import { useApptheme } from "@/lib/context/theme.context";
import useImageUpload from "@/lib/hooks/useImageUpload";
import useMenu, { addonOptionIds } from "@/lib/hooks/useMenu";
import {
  IMenuAddon,
  IMenuCategory,
  IMenuOption,
  IMenuSubCategory,
} from "@/lib/utils/interfaces/menu.interface";
import {
  Chip,
  Field,
  ImageField,
  parseNumber,
  PrimaryButton,
  SecondaryButton,
  Sheet,
} from "./ui";

type Menu = ReturnType<typeof useMenu>;

// ───────────────────────────── Category ─────────────────────────────
export function CategorySheet({
  visible,
  category,
  menu,
  onClose,
  onSaved,
}: {
  visible: boolean;
  category: IMenuCategory | null;
  menu: Menu;
  onClose: () => void;
  /** Called after a successful save with the saved title; the menu has already refreshed. */
  onSaved?: (title: string) => void;
}) {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const { uploading, chooseAndUpload } = useImageUpload();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [newSub, setNewSub] = useState("");
  const [pendingSubs, setPendingSubs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: subData, refetch: refetchSubs } = useQuery<{ subCategoriesByParentId: IMenuSubCategory[] }>(
    SUB_CATEGORIES_BY_PARENT,
    {
      variables: { parentCategoryId: category?._id },
      skip: !category?._id || !visible,
      fetchPolicy: "network-only",
    },
  );
  const existingSubs = subData?.subCategoriesByParentId ?? [];

  useEffect(() => {
    if (!visible) return;
    setTitle(category?.title ?? "");
    setDescription(category?.description ?? "");
    setImage(category?.image ?? "");
    setNewSub("");
    setPendingSubs([]);
    setError("");
  }, [visible, category]);

  const addPendingSub = () => {
    const value = newSub.trim();
    if (!value) return;
    const taken = [...existingSubs.map((s) => s.title), ...pendingSubs].some(
      (s) => s.toLowerCase() === value.toLowerCase(),
    );
    if (!taken) setPendingSubs((prev) => [...prev, value]);
    setNewSub("");
  };

  const removeExistingSub = (sub: IMenuSubCategory) => {
    Alert.alert(t("Delete sub-category"), t("Delete this sub-category?"), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: async () => {
          const ok = await menu.deleteSubCategory(sub._id);
          if (ok) refetchSubs();
        },
      },
    ]);
  };

  const save = async () => {
    if (!title.trim()) return setError(t("Category name is required"));
    setError("");
    setSaving(true);
    const subs = [
      ...pendingSubs,
      ...(newSub.trim() ? [newSub.trim()] : []),
    ].map((s) => ({ title: s }));
    const base = {
      title: title.trim(),
      description: description.trim() || undefined,
      image: image || undefined,
      subCategories: subs,
    };
    const ok = category
      ? await menu.editCategory({ _id: category._id, ...base })
      : await menu.createCategory(base);
    setSaving(false);
    if (ok) {
      onSaved?.(base.title);
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      title={category ? t("Edit category") : t("Add category")}
      onClose={onClose}
    >
      <ImageField
        label={t("Category picture (optional)")}
        uri={image}
        loading={uploading}
        onPress={async () => {
          const url = await chooseAndUpload();
          if (url) setImage(url);
        }}
        onRemove={() => setImage("")}
      />
      <Field
        label={t("Category name")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("e.g. Burgers")}
        error={error}
      />
      <Field
        label={t("Description (optional)")}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text className="mb-1 font-semibold" style={{ color: appTheme.fontMainColor }}>
        {t("Sub-categories (optional)")}
      </Text>
      <View className="mb-2 flex-row flex-wrap">
        {existingSubs.map((sub) => (
          <TouchableOpacity
            key={sub._id}
            onPress={() => removeExistingSub(sub)}
            className="mb-2 mr-2 flex-row items-center gap-1 rounded-full border px-3 py-2"
            style={{ borderColor: appTheme.borderLineColor }}
          >
            <Text style={{ color: appTheme.fontMainColor }}>{sub.title}</Text>
            <Ionicons name="close-circle" size={16} color={appTheme.error} />
          </TouchableOpacity>
        ))}
        {pendingSubs.map((sub) => (
          <TouchableOpacity
            key={sub}
            onPress={() => setPendingSubs((prev) => prev.filter((s) => s !== sub))}
            className="mb-2 mr-2 flex-row items-center gap-1 rounded-full px-3 py-2"
            style={{ backgroundColor: appTheme.lowOpacityPrimaryColor }}
          >
            <Text style={{ color: appTheme.fontMainColor }}>{sub}</Text>
            <Ionicons name="close-circle" size={16} color={appTheme.fontSecondColor} />
          </TouchableOpacity>
        ))}
      </View>
      <View className="mb-4 flex-row items-start gap-2">
        <View className="flex-1">
          <Field
            label=""
            value={newSub}
            onChangeText={setNewSub}
            placeholder={t("Add a sub-category")}
            onSubmitEditing={addPendingSub}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity
          onPress={addPendingSub}
          className="mt-6 h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: appTheme.primary }}
        >
          <Ionicons name="add" size={24} color={appTheme.black} />
        </TouchableOpacity>
      </View>

      <PrimaryButton title={t("Save")} onPress={save} loading={saving} />
      <View className="h-3" />
      <SecondaryButton title={t("Cancel")} onPress={onClose} />
    </Sheet>
  );
}

// ───────────────────────────── Option ─────────────────────────────
export function OptionSheet({
  visible,
  option,
  menu,
  onClose,
}: {
  visible: boolean;
  option: IMenuOption | null;
  menu: Menu;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(option?.title ?? "");
    setDescription(option?.description ?? "");
    setPrice(option ? String(option.price) : "");
    setErrors({});
  }, [visible, option]);

  const save = async () => {
    const next: { title?: string; price?: string } = {};
    const amount = parseNumber(price);
    if (!title.trim()) next.title = t("Name is required");
    if (!Number.isFinite(amount) || amount < 0) next.price = t("Enter a valid price (0 or more)");
    setErrors(next);
    if (next.title || next.price) return;
    setSaving(true);
    const base = { title: title.trim(), description: description.trim() || undefined, price: amount };
    const ok = option
      ? await menu.editOption({ _id: option._id, ...base })
      : await menu.createOption(base);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Sheet visible={visible} title={option ? t("Edit option") : t("Add option")} onClose={onClose}>
      <Field
        label={t("Option name")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("e.g. Extra cheese")}
        error={errors.title}
      />
      <Field
        label={t("Description (optional)")}
        value={description}
        onChangeText={setDescription}
      />
      <Field
        label={t("Price")}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="0"
        hint={t("Use 0 for a free option")}
        error={errors.price}
      />
      <PrimaryButton title={t("Save")} onPress={save} loading={saving} />
      <View className="h-3" />
      <SecondaryButton title={t("Cancel")} onPress={onClose} />
    </Sheet>
  );
}

// ───────────────────────────── Add-on ─────────────────────────────
export function AddonSheet({
  visible,
  addon,
  menu,
  onClose,
  onCreateOption,
}: {
  visible: boolean;
  addon: IMenuAddon | null;
  menu: Menu;
  onClose: () => void;
  /** Opens the option form when the store has no options yet. */
  onCreateOption: () => void;
}) {
  const { t } = useTranslation();
  const { appTheme } = useApptheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("1");
  const [selected, setSelected] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ title?: string; qty?: string; options?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(addon?.title ?? "");
    setDescription(addon?.description ?? "");
    setMin(String(addon?.quantityMinimum ?? 0));
    setMax(String(addon?.quantityMaximum ?? 1));
    setSelected(addon ? addonOptionIds(addon) : []);
    setErrors({});
  }, [visible, addon]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    const next: typeof errors = {};
    const minValue = parseNumber(min);
    const maxValue = parseNumber(max);
    if (!title.trim()) next.title = t("Name is required");
    if (
      !Number.isInteger(minValue) ||
      !Number.isInteger(maxValue) ||
      minValue < 0 ||
      maxValue < 1 ||
      maxValue < minValue
    ) {
      next.qty = t("Maximum must be at least 1 and not less than the minimum");
    }
    if (!selected.length) next.options = t("Choose at least one option");
    setErrors(next);
    if (next.title || next.qty || next.options) return;
    setSaving(true);
    const base = {
      title: title.trim(),
      description: description.trim() || undefined,
      quantityMinimum: minValue,
      quantityMaximum: maxValue,
      options: selected,
    };
    const ok = addon
      ? await menu.editAddon({ _id: addon._id, ...base })
      : await menu.createAddon(base);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Sheet visible={visible} title={addon ? t("Edit add-on") : t("Add add-on")} onClose={onClose}>
      <Field
        label={t("Add-on name")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("e.g. Choose your sauce")}
        error={errors.title}
      />
      <Field
        label={t("Description (optional)")}
        value={description}
        onChangeText={setDescription}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field
            label={t("Min. choices")}
            value={min}
            onChangeText={setMin}
            keyboardType="number-pad"
            hint={t("0 = optional")}
          />
        </View>
        <View className="flex-1">
          <Field
            label={t("Max. choices")}
            value={max}
            onChangeText={setMax}
            keyboardType="number-pad"
          />
        </View>
      </View>
      {errors.qty ? (
        <Text className="-mt-2 mb-3 text-xs" style={{ color: appTheme.error }}>
          {errors.qty}
        </Text>
      ) : null}

      <Text className="mb-2 font-semibold" style={{ color: appTheme.fontMainColor }}>
        {t("Options in this add-on")}
      </Text>
      {menu.options.length ? (
        <View className="flex-row flex-wrap">
          {menu.options.map((option) => (
            <Chip
              key={option._id}
              label={`${option.title} (${option.price})`}
              selected={selected.includes(option._id)}
              onPress={() => toggle(option._id)}
            />
          ))}
        </View>
      ) : (
        <View className="mb-3">
          <Text className="mb-2" style={{ color: appTheme.fontSecondColor }}>
            {t("You have no options yet. Create options first, then group them here.")}
          </Text>
          <SecondaryButton
            title={t("Add option")}
            icon="add"
            onPress={() => {
              onClose();
              onCreateOption();
            }}
          />
        </View>
      )}
      {errors.options ? (
        <Text className="mb-3 text-xs" style={{ color: appTheme.error }}>
          {errors.options}
        </Text>
      ) : null}

      <View className="mt-2">
        <PrimaryButton title={t("Save")} onPress={save} loading={saving} />
      </View>
      <View className="h-3" />
      <SecondaryButton title={t("Cancel")} onPress={onClose} />
    </Sheet>
  );
}
