export interface ITestOrder {
  _id: string;
  orderId: string;
  createdAt: string;
  orderStatus: string;
  total: number;
  orderAmount: number;
  deliveryCharges: number;
  tipping: number;
  taxationAmount: number;
  discount: number;
  paymentMethod: string;
  paymentStatus: string;
  instructions?: string;
  user: { _id: string; name: string; phone: string; email: string };
  restaurant: { _id: string; name: string; address: string };
  deliveryAddress: {
    deliveryAddress: string;
    details: string;
    label: string;
    location: { coordinates: number[] };
  };
  items: Array<{
    _id: string;
    title: string;
    description: string;
    image: string;
    quantity: number;
    specialInstructions: string;
    variation: { _id: string; title: string; price: number; discounted: number };
    addons: Array<{
      _id: string;
      title: string;
      description: string;
      options: Array<{ _id: string; title: string; price: number }>;
    }>;
  }>;
}

export const buildOrder = (overrides: Partial<ITestOrder> = {}): ITestOrder => ({
  _id: 'order-1',
  orderId: '1001',
  createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  orderStatus: 'AWAITING_ADMIN',
  total: 42.5,
  orderAmount: 40,
  deliveryCharges: 2.5,
  tipping: 0,
  taxationAmount: 0,
  discount: 0,
  paymentMethod: 'COD',
  paymentStatus: 'PENDING',
  instructions: 'Ring the bell twice',
  user: { _id: 'user-1', name: 'Sara Ali', phone: '+96170123456', email: 'sara@example.com' },
  restaurant: { _id: 'store-1', name: 'Pizza House', address: 'Main street' },
  deliveryAddress: {
    deliveryAddress: '12 Cedar Street, Beirut',
    details: 'Third floor',
    label: 'Home',
    location: { coordinates: [35.5, 33.9] },
  },
  items: [
    {
      _id: 'item-1',
      title: 'Margherita',
      description: 'Tomato and mozzarella',
      image: '',
      quantity: 2,
      specialInstructions: 'Extra basil',
      variation: { _id: 'var-1', title: 'Large', price: 20, discounted: 20 },
      addons: [
        {
          _id: 'addon-1',
          title: 'Extras',
          description: 'Optional extras',
          options: [{ _id: 'option-1', title: 'Olives', price: 1.5 }],
        },
      ],
    },
  ],
  ...overrides,
});

export const sessionPayload = {
  token: 'test-access-token',
  tokenExpiration: 3600,
  user: {
    userId: 'admin-1',
    name: 'Test Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  },
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      stubAuth(): Chainable<void>;
      stubGraphQL(handlers: {
        orders?: (variables?: Record<string, unknown>) => unknown;
        stats?: () => unknown;
        confirm?: () => unknown;
        reject?: () => unknown;
      }): Chainable<void>;
    }
  }
}
