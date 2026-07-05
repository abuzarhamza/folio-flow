import antfu from '@antfu/eslint-config'

export default antfu(
    {
        test: true,
        stylistic: {
            indent: 4,
            quotes: 'single',
            semi: false,
        },
        rules: {
            // This project doesn't ship to a browser; node globals are always available
            // and the explicit `require("node:...")` boilerplate is noise.
            'node/prefer-global/process': 'off',
            'node/prefer-global/buffer': 'off',
        },
    },
    {
        // This project uses Jest, not Vitest. Declare the Jest globals on test files
        // so the antfu/no-undef rule does not flag them.
        files: ['**/*.test.js', '**/*.spec.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                beforeEach: 'readonly',
                afterAll: 'readonly',
                afterEach: 'readonly',
                jest: 'readonly',
            },
        },
    },
    {
        // Auto-managed by CommandCode; do not lint.
        ignores: ['.commandcode/**'],
    },
)
