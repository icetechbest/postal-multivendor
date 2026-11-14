import { buildOrder } from '../support/fixtures';

const emptyPage = {
  pendingConfirmationCount: 0,
  pendingConfirmationOrders: {
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    nextPage: null,
    prevPage: null,
    orders: [],
  },
};

const pageWith = (orders: ReturnType<typeof buildOrder>[]) => ({
  pendingConfirmationCount: orders.length,
  pendingConfirmationOrders: {
    totalCount: orders.length,
    totalPages: 1,
    currentPage: 1,
    nextPage: null,
    prevPage: null,
    orders,
  },
});

describe('Live order queue', () => {
  beforeEach(() => {
    cy.setCookie('NEXT_LOCALE', 'en');
    cy.stubAuth();
  });

  it('receives a new order automatically without a manual refresh', () => {
    let orders = pageWith([]);
    cy.stubGraphQL({
      orders: () => orders,
      stats: () => ({ allOrdersWithoutPagination: [] }),
    });

    cy.visit('/');
    cy.get('[data-testid="empty-state"]').should('be.visible');

    // The websocket is unavailable in the test runner, so the console falls
    // back to its 15s polling loop. A new order must still appear on its own.
    orders = pageWith([buildOrder()]);
    cy.get('[data-testid="order-card"]', { timeout: 25000 }).should('have.length', 1);
    cy.get('[data-testid="order-number"]').should('contain.text', '1001');
  });

  it('renders the waiting timer in the danger state for old orders', () => {
    cy.stubGraphQL({
      orders: () =>
        pageWith([buildOrder({ createdAt: new Date(Date.now() - 20 * 60_000).toISOString() })]),
      stats: () => ({ allOrdersWithoutPagination: [] }),
    });

    cy.visit('/');
    cy.get('[data-testid="waiting-badge"]').should('contain.text', 'Waiting for 20 min');
  });

  it('searches the queue and shows the empty state', () => {
    cy.stubGraphQL({
      orders: (variables) => (variables?.search ? pageWith([]) : pageWith([buildOrder()])),
      stats: () => ({ allOrdersWithoutPagination: [] }),
    });

    cy.visit('/');
    cy.get('[data-testid="order-card"]').should('have.length', 1);
    cy.get('[data-testid="search-input"]').type('no-such-order');
    cy.get('[data-testid="empty-state"]').should('be.visible');
  });
});
