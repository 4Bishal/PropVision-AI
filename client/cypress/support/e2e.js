// Stable application selectors; use native dialog events for deterministic Escape.
Cypress.Commands.add('getByTestId', (id, options) => cy.get(`[data-testid="${id}"]`, options));
Cypress.Commands.add('escapeDialog', (id) => cy.getByTestId(id).then(($dialog) => {
  const Event = $dialog[0].ownerDocument.defaultView.Event;
  $dialog[0].dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
}));
