import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
    { ignores: ['pyodide/**', 'src/execution/src/**'] },
    { files: ['**/*.{js,mjs,cjs,ts}'] },
    { files: ['**/*.js'], languageOptions: { sourceType: 'script' } },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '_\\w*' }]
        }
    }
];
