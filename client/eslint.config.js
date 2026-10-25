import js from '@eslint/js';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.cache/**', 'cypress/screenshots/**', 'cypress/videos/**', 'cypress/downloads/**'] },
  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': hooks },
    rules: {
      ...js.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  { files: ['public/sw.js'], languageOptions: { globals: { ...globals.serviceworker } } },
  { files: ['cypress/**/*.js'], languageOptions: { globals: { cy: 'readonly', Cypress: 'readonly', describe: 'readonly', it: 'readonly', beforeEach: 'readonly', expect: 'readonly' } } },
];
