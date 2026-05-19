import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
	eslint.configs.recommended,
	{
		ignores: [
			'babel.config.js',
			'metro.config.js',
			'jest.config.js',
			'index.js',
			'App.tsx',
			'__tests__/**',
			'node_modules/**',
			'android/**',
			'ios/**',
		],
	},
	{
		files: ['src/**/*.ts', 'src/**/*.tsx'],
		languageOptions: {
			parser: tsparser,
			globals: {
				console: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				require: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
			prettier: prettier,
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'prettier/prettier': ['error', {}, { usePrettierrc: true }],
			'no-trailing-spaces': 'error',
			'no-empty': 'warn',
		},
	},
];