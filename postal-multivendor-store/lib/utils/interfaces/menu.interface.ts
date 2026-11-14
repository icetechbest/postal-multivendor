export interface IMenuVariation {
  _id?: string;
  title: string;
  price: number;
  discounted: number;
  isOutOfStock: boolean;
  /** Add-on ids attached to this variation. */
  addons: string[];
}

export interface IMenuFood {
  _id: string;
  title: string;
  description: string;
  image: string;
  subCategory?: string | null;
  isActive?: boolean;
  isAvailable?: boolean;
  isOutOfStock?: boolean;
  isPopular?: boolean;
  variations: IMenuVariation[];
}

export interface IMenuSubCategory {
  _id: string;
  title: string;
  parentCategoryId?: string;
}

export interface IMenuCategory {
  _id: string;
  title: string;
  description?: string | null;
  image?: string | null;
  foods: IMenuFood[];
}

export interface IMenuOption {
  _id: string;
  title: string;
  description?: string | null;
  price: number;
}

export interface IMenuAddon {
  _id: string;
  title: string;
  description?: string | null;
  quantityMinimum: number;
  quantityMaximum: number;
  /** Option ids (store-managed add-ons) or embedded option objects (legacy add-ons). */
  options: Array<string | { _id: string }> | null;
}

export interface IStoreMenuResponse {
  restaurant: {
    _id: string;
    name: string;
    categories: IMenuCategory[];
    options: IMenuOption[];
    addons: IMenuAddon[];
  } | null;
}

/** A food flattened together with the category it belongs to. */
export interface IMenuFoodWithCategory extends IMenuFood {
  categoryId: string;
  categoryTitle: string;
}

export interface IFoodFormValues {
  _id?: string;
  title: string;
  description: string;
  image: string;
  category: string;
  subCategory: string;
  variations: IMenuVariation[];
}
