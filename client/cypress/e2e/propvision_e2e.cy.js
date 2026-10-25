const byId = (id) => `[data-testid="${id}"]`;
function predict() {
  cy.getByTestId('nav-predict').click();
  cy.getByTestId('select-sector').should('be.enabled').select('sector 54');
  for (const [name, value] of Object.entries({ property_type: 'flat', balcony: '1', agePossession: 'Relatively New', furnishing_type: 'semifurnished', floor_category: 'High-Rise', luxury_category: 'Luxury' })) {
    cy.get(`form [name="${name}"]`).select(value);
  }
  cy.getByTestId('input-built-up-area').clear().type('2100');
  cy.getByTestId('btn-calculate-valuation').click();
  cy.wait('@predict').its('request.body').should('include', { sector: 'sector 54', built_up_area: 2100, bedRoom: 3 });
  cy.getByTestId('predicted-price-value').should('contain', '2.45 Cr');
}
function unlocked() { cy.get('body').should(($body) => expect($body[0].style.overflow).not.to.eq('hidden')); }
function openMapSector() {
  cy.getByTestId('nav-analytics').click();
  cy.get('.map-panel').scrollIntoView();
  cy.get('.leaflet-marker-icon[title^="new:"]', { timeout: 15000 }).click();
  cy.getByTestId('geomap-sector-modal').should('be.visible');
}

describe('PropVision integrated UI flows', () => {
  beforeEach(() => {
    cy.fixture('propvision').then((data) => {
      cy.intercept('GET', '**/api/health', { express: 'online', fastapi: 'online' });
      cy.intercept('GET', '**/api/schema-options', { categories: data.categories }).as('schema');
      cy.intercept('GET', '**/api/analytics/*', (req) => req.reply(data.analytics[new URL(req.url).pathname.split('/').pop()])).as('analytics');
      cy.intercept('GET', '**/api/insights/*', (req) => req.reply(data.insights[new URL(req.url).pathname.split('/').pop()])).as('insights');
      cy.intercept('POST', '**/api/predict', { delay: 150, body: data.prediction }).as('predict');
      cy.intercept('POST', '**/api/recommend/contextual', data.recommendations).as('contextual');
      cy.intercept('POST', '**/api/recommend/similar', data.recommendations).as('similar');
      cy.intercept('GET', 'https://*.tile.openstreetmap.org/**', { statusCode: 204 });
    });
    cy.visit('/', { onBeforeLoad: (win) => win.localStorage.clear() });
    cy.wait('@schema');
  });

  it('Module 1: Predictor enters focus mode, uses empirical bounds, and restores editable inputs', () => {
    predict();
    cy.getByTestId('compact-summary-bar').should('contain', '3 BHK, sector 54, 2,100 sq.ft');
    cy.getByTestId('prediction-interval-bounds').should('contain', '80% CI:').and('contain', '2.20 Cr').and('contain', '2.80 Cr');
    cy.getByTestId('btn-calculate-valuation').should('not.be.visible');
    cy.contains('button', 'Edit Parameters').click();
    cy.getByTestId('select-sector').should('have.value', 'sector 54');
    cy.getByTestId('input-built-up-area').should('have.value', '2100');
  });

  for (const method of ['Escape', 'Close', 'backdrop']) {
    it(`Module 2: GeoMap ${method} removes unresolved fragments and allows reopening`, () => {
      openMapSector();
      cy.getByTestId('sector-modal-title').should('contain', 'Sector property details');
      cy.getByTestId('geomap-sector-modal').should('contain', "Location 'new' is unresolved.");
      if (method === 'Escape') cy.escapeDialog('geomap-sector-modal');
      else if (method === 'Close') cy.getByTestId('geomap-sector-modal').find(byId('btn-close-modal')).click();
      else cy.getByTestId('geomap-sector-modal').then(($dialog) => {
        const win = $dialog[0].ownerDocument.defaultView;
        $dialog[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true, clientX: -1, clientY: -1 }));
      });
      cy.getByTestId('geomap-sector-modal').should('not.exist');
      cy.get('.sector-reference-details, .leaflet-popup').should('not.exist');
      unlocked(); openMapSector();
    });
  }

  it('Module 3: Market Insights opens narrative sector details and restores scrolling', () => {
    cy.getByTestId('nav-insights').click();
    cy.getByTestId('sector-tier-card').should('be.visible');
    cy.contains('button', 'Explore sector 54').click();
    cy.getByTestId('sector-narrative-modal').should('be.visible');
    cy.getByTestId('sector-narrative-modal').should('contain', 'sector 54');
    cy.get('body').should('have.css', 'overflow', 'hidden');
    cy.escapeDialog('sector-narrative-modal');
    cy.getByTestId('sector-narrative-modal').should('not.exist'); unlocked();
  });

  it('Module 4: contextual cards compare metrics and inspect the selected property without stalling', () => {
    predict();
    cy.wait('@contextual').its('request.body').should('include', { sector: 'sector 54', price: 24500000 });
    cy.getByTestId('recommendation-carousel').find(byId('property-card')).first().within(() => {
      cy.getByTestId('vector-match-badge').should('contain', '94.2% Match');
      cy.getByTestId('btn-inspect-compare').click();
    });
    cy.getByTestId('property-comparison-modal').should('be.visible');
    cy.getByTestId('comparison-grid').should('contain', 'Price/sqft').and('contain', 'Sector Tier');
    cy.getByTestId('btn-select-inspect').click();
    cy.getByTestId('property-inspector-drawer').should('be.visible').and('contain', 'Premium Luxury').and('contain', 'Relatively New');
    cy.getByTestId('btn-select-inspect').should('be.disabled').and('contain', 'Currently Inspecting');
    cy.escapeDialog('property-inspector-drawer');
    cy.getByTestId('property-inspector-drawer').should('not.exist');
    cy.get('body').should('have.css', 'overflow', 'hidden');
    cy.getByTestId('btn-select-inspect').click();
    cy.getByTestId('btn-close-drawer').click();
    cy.getByTestId('property-comparison-modal').find(byId('btn-close-modal')).click(); unlocked();
  });

  it('Global: persists themes and shows back-to-top only after scrolling', () => {
    cy.getByTestId('theme-toggle').click();
    cy.get('html').should('have.attr', 'data-theme', 'dark');
    cy.reload(); cy.get('html').should('have.attr', 'data-theme', 'dark');
    cy.getByTestId('theme-toggle').click();
    cy.get('html').should('have.attr', 'data-theme', 'light');
    cy.getByTestId('nav-insights').click();
    cy.getByTestId('sector-tier-card').should('be.visible');
    cy.getByTestId('btn-scroll-top').should('not.exist');
    cy.scrollTo(0, 500); cy.getByTestId('btn-scroll-top').should('be.visible').click();
    cy.window().its('scrollY').should('eq', 0);
    cy.getByTestId('btn-scroll-top').should('not.exist');
  });
});

it('Brand, PWA assets, direct Predictor routing and install prompt are wired', () => {
  cy.fixture('propvision').then((data) => {
    cy.intercept('GET', '**/api/schema-options', { categories: data.categories });
    cy.intercept('GET', '**/api/health', { express: 'online', fastapi: 'online' });
  });
  cy.visit('/predictor');
  cy.getByTestId('select-sector').should('be.visible');
  cy.get('a[aria-label="PropVision AI home"]').should('have.attr', 'href', '/predictor').find('img').should('have.attr', 'src', '/assets/logo.png');
  cy.title().should('eq', 'PropVision AI — Real Estate Intelligence');
  cy.request('/manifest.json').its('body').should('include', { start_url: '/predictor', theme_color: '#0F172A' });
  for (const path of ['logo.png', 'logo-dark.png', 'logo-vertical.png', 'favicon.png', 'logo-navy.png', 'logo-white.png', 'icon-512.png']) {
    cy.request(`/assets/${path}`).its('headers.content-type').should('contain', 'image/png');
  }
  cy.window().then((win) => {
    const event = new win.Event('beforeinstallprompt', { cancelable: true });
    event.prompt = cy.stub().resolves().as('installPrompt');
    win.dispatchEvent(event);
  });
  cy.getByTestId('btn-install-app').click(); cy.get('@installPrompt').should('have.been.calledOnce');
  cy.getByTestId('btn-install-app').should('not.exist');
});

it('Integrated recommendations keep the floating theme control usable over native dialogs', () => {
  cy.fixture('propvision').then((data) => {
    cy.intercept('GET', '**/api/schema-options', { categories: data.categories });
    cy.intercept('GET', '**/api/health', { express: 'online', fastapi: 'online' });
    cy.intercept('POST', '**/api/recommend/contextual', data.recommendations);
    cy.intercept('POST', '**/api/predict', data.prediction).as('predict');
  });
  cy.visit('/predictor', { onBeforeLoad: (win) => win.localStorage.clear() });
  predict();
  cy.getByTestId('btn-inspect-compare').first().click();
  cy.getByTestId('property-comparison-modal').find('[data-testid="theme-toggle"]').should('be.visible').click();
  cy.get('html').should('have.attr', 'data-theme', 'dark');
  cy.get('a[aria-label="PropVision AI home"] img').should('have.attr', 'src', '/assets/logo-dark.png');
  cy.getByTestId('btn-select-inspect').click();
  cy.getByTestId('property-inspector-drawer').find('[data-testid="theme-toggle"]').should('be.visible').click();
  cy.get('html').should('have.attr', 'data-theme', 'light');
  cy.getByTestId('btn-close-drawer').click();
  cy.getByTestId('property-comparison-modal').find('[data-testid="btn-close-modal"]').click();
  cy.get('body > [data-testid="theme-toggle"]').should('be.visible');
});
