const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { files: ['supabase/functions/**/*.ts'], rules: { 'import/no-unresolved': ['error', { ignore: ['^npm:'] }] } },
  { ignores: ['dist/*', 'dist-ui/**', 'test-results/**', '.expo/*'] },
]);
