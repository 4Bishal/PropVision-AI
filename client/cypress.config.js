import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: { baseUrl: 'http://localhost:5173', supportFile: 'cypress/support/e2e.js' },
  viewportWidth: 1440, viewportHeight: 900,
  video: false, screenshotOnRunFailure: true,
});
