import './commands';

// Keep test output focused on application errors.
Cypress.on('uncaught:exception', (error) => {
  if (error.message.includes('ResizeObserver')) return false;
  return true;
});
