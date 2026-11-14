import { buildOrder } from '../support/fixtures';

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

describe('Order actions', () => {
  beforeEach(() => {
    cy.setCookie('NEXT_LOCALE', 'en');
    cy.stubAuth();
  });

  it('confirms an order with an optional note', () => {
    cy.stubGraphQL({
      orders: () => pageWith([buildOrder()]),
      stats: () => ({ allOrdersWithoutPagination: [] }),
      confirm: () => ({
        data: {
          adminConfirmOrder: {
            _id: 'order-1',
            orderStatus: 'PENDING',
            adminConfirmedAt: new Date().toISOString(),
          },
        },
      }),
    });

    cy.visit('/');
    cy.get('[data-testid="confirm-button"]').click();
    cy.get('[data-testid="modal"]').should('be.visible');
    cy.get('[data-testid="confirm-note"]').type('Verified with the store');
    cy.get('[data-testid="confirm-submit"]').click();

    cy.get('[data-testid="toast"]').should('contain.text', 'Order confirmed');
    cy.get('[data-testid="order-card"]').should('have.length', 0);
    cy.get('[data-testid="empty-state"]').should('be.visible');
  });

  it('requires a reason before rejecting and then rejects the order', () => {
    cy.stubGraphQL({
      orders: () => pageWith([buildOrder()]),
      stats: () => ({ allOrdersWithoutPagination: [] }),
      reject: () => ({
        data: {
          adminRejectOrder: {
            _id: 'order-1',
            orderStatus: 'CANCELLED',
            adminRejectedAt: new Date().toISOString(),
          },
        },
      }),
    });

    cy.visit('/');
    cy.get('[data-testid="reject-button"]').click();
    cy.get('[data-testid="reject-submit"]').click();
    cy.get('[data-testid="modal"]').should('contain.text', 'A rejection reason is required');

    cy.get('[data-testid="modal"]').contains('Store is closed').click();
    cy.get('[data-testid="reject-submit"]').click();

    cy.get('[data-testid="toast"]').should('contain.text', 'Order rejected');
    cy.get('[data-testid="order-card"]').should('have.length', 0);
  });

  it('handles a concurrent confirmation by another operator gracefully', () => {
    cy.stubGraphQL({
      orders: () => pageWith([buildOrder()]),
      stats: () => ({ allOrdersWithoutPagination: [] }),
      confirm: () => ({
        errors: [
          {
            message:
              'Order is no longer awaiting confirmation (current status: PENDING). It may have been confirmed or rejected by someone else.',
            extensions: { code: 'CONFLICT' },
          },
        ],
        data: null,
      }),
    });

    cy.visit('/');
    cy.get('[data-testid="confirm-button"]').click();
    cy.get('[data-testid="confirm-submit"]').click();

    cy.get('[data-testid="toast"]').should('contain.text', 'already handled by another operator');
    cy.get('[data-testid="order-card"]').should('have.length', 0);
  });
});
