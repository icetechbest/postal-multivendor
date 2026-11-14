import { render, screen } from '@testing-library/react-native';

import OrdersScreen from '../app/(tabs)/orders/index';

const mockPush = jest.fn();
const mockRefetch = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useFocusEffect: () => undefined,
}));

jest.mock('../lib/auth/auth-context', () => ({
  useAuth: () => ({ handleAuthError: jest.fn() }),
}));

jest.mock('../lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
    isRtl: false,
    setLocale: jest.fn(),
  }),
}));

jest.mock('../lib/theme', () => ({
  useTheme: () => ({
    mode: 'light',
    colors: {
      background: '#fff',
      surface: '#fff',
      surfaceMuted: '#eee',
      text: '#000',
      textMuted: '#666',
      border: '#ddd',
      primary: '#0f766e',
      primaryText: '#fff',
      danger: '#dc2626',
      success: '#059669',
      warning: '#d97706',
    },
    setMode: jest.fn(),
  }),
}));

const mockUseQuery = jest.fn();
jest.mock('@apollo/client', () => {
  const actual = jest.requireActual('@apollo/client');
  return { ...actual, useQuery: (...args: unknown[]) => mockUseQuery(...args) };
});

const order = {
  _id: 'order-1',
  orderId: 'ORD-1001',
  orderStatus: 'PENDING',
  total: 42.5,
  paymentMethod: 'COD',
  paymentStatus: 'PENDING',
  createdAt: new Date().toISOString(),
  user: { _id: 'u1', name: 'Sara Ali', phone: '+966500000000' },
  restaurant: { _id: 'r1', name: 'Pizza House' },
};

describe('OrdersScreen', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockPush.mockReset();
  });

  it('renders orders returned by the query', () => {
    mockUseQuery.mockReturnValue({
      data: {
        allOrdersPaginated: {
          totalCount: 1,
          currentPage: 1,
          totalPages: 1,
          orders: [order],
        },
      },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
      fetchMore: jest.fn(),
      networkStatus: 7,
    });

    render(<OrdersScreen />);

    expect(screen.getByText('#ORD-1001')).toBeTruthy();
    expect(screen.getByText(/Sara Ali/)).toBeTruthy();
    // "PENDING" appears both in the status filter chips and the order badge.
    expect(screen.getAllByText('PENDING').length).toBeGreaterThan(0);
  });

  it('shows the empty state when no orders match', () => {
    mockUseQuery.mockReturnValue({
      data: {
        allOrdersPaginated: {
          totalCount: 0,
          currentPage: 1,
          totalPages: 0,
          orders: [],
        },
      },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
      fetchMore: jest.fn(),
      networkStatus: 7,
    });

    render(<OrdersScreen />);

    expect(screen.getByText('orders.empty')).toBeTruthy();
  });
});
