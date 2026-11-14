import { ReactNode } from "react";
import { ORDER_TYPE } from "../types";
import { IGlobalComponentProps } from "./global.interface";
import { IRestaurantProfile } from "./resturant.interface";
import { IRiderProfile } from "./user.interface";

export interface IOrderComponentProps extends IGlobalComponentProps {

  tab: ORDER_TYPE;
}

export interface IOrder {
  _id: string;
  orderId: string;
  paymentMethod?: string;
  items: Array<{
    variation: {
      price: number;
      title: string;
    };
    addons?: Array<{
      _id: string;
      options: Array<{
        _id: string;
        price: number;
        title: string;
      }>;
    }>;
    description: ReactNode;
    image: string;
    title: string;
    quantity: number;
  }>;
  user: {
    _id: string;
    name: string;
    phone: string;
  };
  paymentStatus: string;
  createdAt: string;
  acceptedAt: string;
  deliveryAddress: {
    deliveryAddress: string;
    location: {
      coordinates: Array<number>;
    };
  };
  orderAmount: number;
  /** Final amount the customer pays (items + delivery + tip + tax - discounts). */
  total?: number;
  discount?: number;
  coinsDiscount?: number;
  /** Part of the total already paid from the customer's wallet (rider collects total - walletUsed). */
  walletUsed?: number;
  changeAmount?: number;
  tipping?: number;
  taxationAmount?: number;
  deliveryCharges?: number;
  paidAmount?: number;
  orderStatus: string;
  preparationTime: string;
  completionTime: string;
  isPickedUp: boolean;
  isRiderRinged: boolean;
  rider: IRiderProfile;
  restaurant: IRestaurantProfile;
}
