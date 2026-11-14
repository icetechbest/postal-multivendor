import { gql } from "@apollo/client";

export const STORE_MENU = gql`
  query StoreMenu($restaurantId: String) {
    restaurant(id: $restaurantId) {
      _id
      name
      categories {
        _id
        title
        description
        image
        foods {
          _id
          title
          description
          image
          subCategory
          isActive
          isAvailable
          isOutOfStock
          isPopular
          variations {
            _id
            title
            price
            discounted
            isOutOfStock
            addons
          }
        }
      }
      options {
        _id
        title
        description
        price
      }
      addons {
        _id
        title
        description
        quantityMinimum
        quantityMaximum
        options
      }
    }
  }
`;

export const SUB_CATEGORIES_BY_PARENT = gql`
  query SubCategoriesByParentId($parentCategoryId: String!) {
    subCategoriesByParentId(parentCategoryId: $parentCategoryId) {
      _id
      title
      parentCategoryId
    }
  }
`;
