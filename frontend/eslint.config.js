import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Artefatos gerados — nunca devem ser lintados (build do Vite + projeto Capacitor)
  globalIgnores(['dist', 'dev-dist', 'android', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Testes (Vitest) rodam em Node: liberam `global` e afins
    files: ['**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
])
