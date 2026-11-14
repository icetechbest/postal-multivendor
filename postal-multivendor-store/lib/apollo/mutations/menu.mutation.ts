import { gql } from "@apollo/client";

// ---------- images
export const UPLOAD_IMAGE = gql`
  mutation UploadImageToS3($image: String!) {
    uploadImageToS3(image: $image) {
      imageUrl
    }
  }
`;

// ---------- categories
export const CREATE_CATEGORY = gql`
  mutation CreateCategory($category: CategoryInput) {
    createCategory(category: $category) {
      _id
    }
  }
`;

export const EDIT_CATEGORY = gql`
  mutation EditCategory($category: CategoryInput) {
    editCategory(category: $category) {
      _id
    }
  }
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: String!, $restaurant: String) {
    deleteCategory(id: $id, restaurant: $restaurant) {
      _id
    }
  }
`;

export const DELETE_SUB_CATEGORY = gql`
  mutation DeleteSubCategory($id: String!) {
    deleteSubCategory(_id: $id)
  }
`;

// ---------- foods
export const CREATE_FOOD = gql`
  mutation CreateFood($foodInput: FoodInput!) {
    createFood(foodInput: $foodInput) {
      _id
    }
  }
`;

export const EDIT_FOOD = gql`
  mutation EditFood($foodInput: FoodInput!) {
    editFood(foodInput: $foodInput) {
      _id
    }
  }
`;

export const DELETE_FOOD = gql`
  mutation DeleteFood($id: String!, $restaurant: String, $categoryId: String) {
    deleteFood(id: $id, restaurant: $restaurant, categoryId: $categoryId) {
      _id
    }
  }
`;

export const UPDATE_FOOD_AVAILABILITY = gql`
  mutation UpdateFoodOutOfStock(
    $id: String!
    $restaurant: String
    $categoryId: String
    $isAvailable: Boolean
  ) {
    updateFoodOutOfStock(
      id: $id
      restaurant: $restaurant
      categoryId: $categoryId
      isAvailable: $isAvailable
    )
  }
`;

// ---------- add-ons
export const CREATE_ADDONS = gql`
  mutation CreateAddons($addonInput: AddonInput) {
    createAddons(addonInput: $addonInput) {
      _id
    }
  }
`;

export const EDIT_ADDON = gql`
  mutation EditAddon($addonInput: editAddonInput) {
    editAddon(addonInput: $addonInput) {
      _id
    }
  }
`;

export const DELETE_ADDON = gql`
  mutation DeleteAddon($id: String!, $restaurant: String!) {
    deleteAddon(id: $id, restaurant: $restaurant) {
      _id
    }
  }
`;

// ---------- options
export const CREATE_OPTIONS = gql`
  mutation CreateOptions($optionInput: CreateOptionInput) {
    createOptions(optionInput: $optionInput) {
      _id
    }
  }
`;

export const EDIT_OPTION = gql`
  mutation EditOption($optionInput: editOptionInput) {
    editOption(optionInput: $optionInput) {
      _id
    }
  }
`;

export const DELETE_OPTION = gql`
  mutation DeleteOption($id: String!, $restaurant: String!) {
    deleteOption(id: $id, restaurant: $restaurant) {
      _id
    }
  }
`;
