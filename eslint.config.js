const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Providers intentionally load and synchronize external data in effects.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores(['dist/**', '.expo/**', '.expo-export-check/**', 'android/**', 'ios/**']),
]);
