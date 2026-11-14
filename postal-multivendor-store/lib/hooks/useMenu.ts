import { useCallback, useMemo } from "react";
import { DocumentNode, useApolloClient, useQuery } from "@apollo/client";
import { useTranslation } from "react-i18next";
import { showMessage } from "react-native-flash-message";

import { useUserContext } from "@/lib/context/global/user.context";
import { STORE_MENU } from "@/lib/apollo/queries/menu.query";
import {
  CREATE_ADDONS,
  CREATE_CATEGORY,
  CREATE_FOOD,
  CREATE_OPTIONS,
  DELETE_ADDON,
  DELETE_CATEGORY,
  DELETE_FOOD,
  DELETE_OPTION,
  DELETE_SUB_CATEGORY,
  EDIT_ADDON,
  EDIT_CATEGORY,
  EDIT_FOOD,
  EDIT_OPTION,
  UPDATE_FOOD_AVAILABILITY,
} from "@/lib/apollo/mutations/menu.mutation";
import {
  IFoodFormValues,
  IMenuAddon,
  IMenuCategory,
  IMenuFoodWithCategory,
  IMenuOption,
  IStoreMenuResponse,
} from "@/lib/utils/interfaces/menu.interface";

/** Pulls the most useful message out of an Apollo error. */
export const errorMessage = (error: unknown, fallback: string): string => {
  const anyError = error as {
    graphQLErrors?: Array<{ message?: string }>;
    networkError?: { message?: string; result?: { errors?: Array<{ message?: string }> } };
    message?: string;
  };
  return (
    anyError?.graphQLErrors?.[0]?.message ||
    anyError?.networkError?.result?.errors?.[0]?.message ||
    anyError?.message ||
    fallback
  );
};

/** Option ids of an add-on (store-managed add-ons hold ids, legacy ones embed objects). */
export const addonOptionIds = (addon: IMenuAddon): string[] =>
  (addon.options ?? []).map((option) =>
    typeof option === "string" ? option : option?._id,
  ).filter(Boolean) as string[];

/** Lowest and highest selling price of a food (a discounted price wins over the base price). */
export const priceRange = (food: { variations: Array<{ price: number; discounted: number }> }) => {
  const prices = food.variations.map((v) => (v.discounted > 0 ? v.discounted : v.price));
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

export const isFoodAvailable = (food: { isAvailable?: boolean; isOutOfStock?: boolean }) =>
  food.isAvailable !== false && !food.isOutOfStock;

export default function useMenu() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { userId } = useUserContext();

  const { data, loading, error, refetch, networkStatus } = useQuery<
    IStoreMenuResponse,
    { restaurantId: string }
  >(STORE_MENU, {
    variables: { restaurantId: userId },
    skip: !userId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const restaurant = data?.restaurant ?? null;
  const categories: IMenuCategory[] = useMemo(
    () => restaurant?.categories ?? [],
    [restaurant],
  );
  const options: IMenuOption[] = useMemo(() => restaurant?.options ?? [], [restaurant]);
  const addons: IMenuAddon[] = useMemo(() => restaurant?.addons ?? [], [restaurant]);
  const foods: IMenuFoodWithCategory[] = useMemo(
    () =>
      categories.flatMap((category) =>
        (category.foods ?? []).map((food) => ({
          ...food,
          categoryId: category._id,
          categoryTitle: category.title,
        })),
      ),
    [categories],
  );

  /**
   * Runs a mutation, refreshes the menu and reports failures. Resolves to
   * true on success so callers can close their forms.
   */
  const run = useCallback(
    async (
      mutation: DocumentNode,
      variables: Record<string, unknown>,
      failure: string,
    ): Promise<boolean> => {
      try {
        await client.mutate({
          mutation,
          variables,
          refetchQueries: [{ query: STORE_MENU, variables: { restaurantId: userId } }],
          awaitRefetchQueries: true,
        });
        return true;
      } catch (err) {
        showMessage({ message: errorMessage(err, t(failure)), type: "danger" });
        return false;
      }
    },
    [client, userId, t],
  );

  const foodInput = (values: IFoodFormValues) => ({
    ...(values._id ? { _id: values._id } : {}),
    restaurant: userId,
    title: values.title.trim(),
    description: values.description.trim() || values.title.trim(),
    image: values.image,
    category: values.category,
    subCategory: values.subCategory || undefined,
    variations: values.variations.map((variation) => ({
      ...(variation._id ? { _id: variation._id } : {}),
      title: variation.title.trim(),
      price: Number(variation.price),
      discounted: Number(variation.discounted) || 0,
      isOutOfStock: Boolean(variation.isOutOfStock),
      addons: variation.addons ?? [],
    })),
  });

  return {
    userId,
    loading: !userId || (loading && !data),
    refreshing: networkStatus === 4,
    error,
    refetch,
    restaurant,
    categories,
    foods,
    options,
    addons,

    // ----- foods
    createFood: (values: IFoodFormValues) =>
      run(CREATE_FOOD, { foodInput: foodInput(values) }, "Failed to add the item"),
    editFood: (values: IFoodFormValues) =>
      run(EDIT_FOOD, { foodInput: foodInput(values) }, "Failed to update the item"),
    deleteFood: (id: string) =>
      run(DELETE_FOOD, { id, restaurant: userId }, "Failed to delete the item"),
    setFoodAvailability: (id: string, isAvailable: boolean) =>
      run(
        UPDATE_FOOD_AVAILABILITY,
        { id, restaurant: userId, isAvailable },
        "Failed to update availability",
      ),

    // ----- categories
    createCategory: (input: {
      title: string;
      description?: string;
      image?: string;
      subCategories?: Array<{ title: string }>;
    }) =>
      run(
        CREATE_CATEGORY,
        { category: { ...input, restaurant: userId } },
        "Failed to add the category",
      ),
    editCategory: (input: {
      _id: string;
      title: string;
      description?: string;
      image?: string;
      subCategories?: Array<{ title: string }>;
    }) =>
      run(
        EDIT_CATEGORY,
        { category: { ...input, restaurant: userId } },
        "Failed to update the category",
      ),
    deleteCategory: (id: string) =>
      run(DELETE_CATEGORY, { id, restaurant: userId }, "Failed to delete the category"),
    deleteSubCategory: (id: string) =>
      run(DELETE_SUB_CATEGORY, { id }, "Failed to delete the sub-category"),

    // ----- add-ons
    createAddon: (input: {
      title: string;
      description?: string;
      quantityMinimum: number;
      quantityMaximum: number;
      options: string[];
    }) =>
      run(
        CREATE_ADDONS,
        { addonInput: { restaurant: userId, addons: [input] } },
        "Failed to add the add-on",
      ),
    editAddon: (input: {
      _id: string;
      title: string;
      description?: string;
      quantityMinimum: number;
      quantityMaximum: number;
      options: string[];
    }) =>
      run(
        EDIT_ADDON,
        { addonInput: { restaurant: userId, addons: input } },
        "Failed to update the add-on",
      ),
    deleteAddon: (id: string) =>
      run(DELETE_ADDON, { id, restaurant: userId }, "Failed to delete the add-on"),

    // ----- options
    createOption: (input: { title: string; description?: string; price: number }) =>
      run(
        CREATE_OPTIONS,
        { optionInput: { restaurant: userId, options: [input] } },
        "Failed to add the option",
      ),
    editOption: (input: { _id: string; title: string; description?: string; price: number }) =>
      run(
        EDIT_OPTION,
        { optionInput: { restaurant: userId, options: input } },
        "Failed to update the option",
      ),
    deleteOption: (id: string) =>
      run(DELETE_OPTION, { id, restaurant: userId }, "Failed to delete the option"),
  };
}
