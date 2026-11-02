import { sessionPayload } from './fixtures';

Cypress.Commands.add('stubAuth', () => {
  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 200,
    body: sessionPayload,
  }).as('refresh');
  cy.intercept('POST', '**/api/auth/logout', { statusCode: 200, body: {} });
});

Cypress.Commands.add('stubGraphQL', (handlers) => {
  cy.intercept('POST', '**/graphql', (request) => {
    const body = request.body as
      { operationName?: string; variables?: Record<string, unknown> } | undefined;
    const operation = body?.operationName;
    if (operation === 'PendingConfirmationOrders') {
      request.reply({ body: { data: handlers.orders?.(body?.variables) } });
      return;
    }
    if (operation === 'TodayConfirmationStats') {
      request.reply({ body: { data: handlers.stats?.() } });
      return;
    }
    if (operation === 'AdminConfirmOrder') {
      request.reply({ body: handlers.confirm?.() });
      return;
    }
    if (operation === 'AdminRejectOrder') {
      request.reply({ body: handlers.reject?.() });
      return;
    }
    request.reply({ body: { data: {} } });
  }).as('graphql');
});

export {};
