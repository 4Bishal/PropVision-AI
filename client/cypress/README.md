# Cypress E2E tests

From `client/`, install dependencies with `npm install`, start Vite with `npm run dev -- --port 5173 --strictPort`, then use another terminal:

- `npm run test:e2e` opens the interactive Cypress runner.
- `npm run test:e2e:headless` runs Electron headlessly.

The ESM config targets `http://localhost:5173` at 1440 × 900. Failures create screenshots; videos are disabled. Set `CYPRESS_BASE_URL` to target a different Vite URL.

The suite uses deterministic API fixtures (`cypress/fixtures/propvision.json`) and intercepts map tiles, so Express, FastAPI, MongoDB, and external tile access are not needed. It tests the actual rendered React/Leaflet UI. This is a UI orchestration suite, not backend/model integration validation. Backend behavior remains covered by the Python and Express tests.

Coverage includes Predictor payloads, focus/edit mode and empirical bounds; unresolved GeoMap sectors and all modal exit paths; Insights narrative-to-sector navigation; contextual recommendations, comparison, nested inspector and body locks; persisted light/dark themes; and back-to-top behavior. Escape is dispatched as the native dialog `cancel` event, matching the event the browser emits for Escape.

Stable selectors use `data-testid`; `cy.getByTestId()` is defined in `cypress/support/e2e.js`. Selectors shared by dialogs (close button and title) must be scoped to the dialog under test. Cypress specs are excluded from Vitest discovery and use their own ESLint globals.

In this managed workspace the browser binary was installed with a project-local cache. Use `$env:CYPRESS_CACHE_FOLDER = "$PWD\.cache\cypress"` in PowerShell when running that binary. Ordinary installations use Cypress's default cache. Cache, screenshots, videos and downloads are ignored by Git.

If another dev server has stale optimized modules after installing dependencies, start an isolated server with `npm run dev -- --port 5174 --strictPort --force` and run `npm run test:e2e:headless -- --config baseUrl=http://127.0.0.1:5174`. This was the verified headless setup (7 passing). If the host sets `ELECTRON_RUN_AS_NODE`, remove that environment variable in the test terminal before launching Cypress.
