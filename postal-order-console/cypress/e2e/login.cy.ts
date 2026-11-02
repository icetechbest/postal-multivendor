import { sessionPayload } from '../support/fixtures';

describe('Login', () => {
  beforeEach(() => {
    cy.setCookie('NEXT_LOCALE', 'en');
  });

  it('signs in with email and password and opens the queue', () => {
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 401,
      body: { message: 'No session' },
    });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: sessionPayload,
    }).as('login');
    cy.stubGraphQL({
      orders: () => ({
        pendingConfirmationCount: 0,
        pendingConfirmationOrders: {
          totalCount: 0,
          totalPages: 1,
          currentPage: 1,
          nextPage: null,
          prevPage: null,
          orders: [],
        },
      }),
      stats: () => ({ allOrdersWithoutPagination: [] }),
    });

    cy.visit('/login');
    cy.get('[data-testid="login-email"]').type('admin@example.com');
    cy.get('[data-testid="login-password"]').type('secret123');
    cy.get('[data-testid="login-submit"]').click();

    cy.wait('@login');
    cy.location('pathname').should('eq', '/');
    cy.get('[data-testid="pending-count"]').should('contain.text', '0');
    cy.get('[data-testid="empty-state"]').should('be.visible');
  });

  it('shows an error for invalid credentials', () => {
    cy.intercept('POST', '**/api/auth/refresh', { statusCode: 401, body: {} });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 401,
      body: { message: 'Invalid email or password' },
    }).as('login');

    cy.visit('/login');
    cy.get('[data-testid="login-email"]').type('wrong@example.com');
    cy.get('[data-testid="login-password"]').type('nope');
    cy.get('[data-testid="login-submit"]').click();

    cy.wait('@login');
    cy.get('[role="alert"]').should('contain.text', 'Invalid email or password');
    cy.location('pathname').should('eq', '/login');
  });
});
