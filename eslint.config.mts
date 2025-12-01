// eslint.config.mjs
// @ts-check
import eslint from "@eslint/js";
import eslintCommentsConfigs from "@eslint-community/eslint-plugin-eslint-comments/configs";
import suggestMembers from "@ton-ai-core/eslint-plugin-suggest-members";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";
import sqlPlugin from "eslint-plugin-sql";
import sqlTemplatePlugin from "eslint-plugin-sql-template";
import { createSqlitePlugin } from "eslint-plugin-sqlite";
import drizzle from "eslint-plugin-drizzle";
import typeormTypescriptPlugin from "eslint-plugin-typeorm-typescript";
import vitest from "eslint-plugin-vitest";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

const sqlitePlugin = createSqlitePlugin();
const reactHooksPlugin = { meta: reactHooks.meta, rules: reactHooks.rules };
const drizzleFlatConfig = {
	plugins: { drizzle },
	languageOptions: {
		ecmaVersion: 2024,
		sourceType: "module",
	},
	rules: drizzle.configs.recommended.rules,
};

export default defineConfig(
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	suggestMembers.configs.recommended,
	drizzleFlatConfig,
	eslintCommentsConfigs.recommended,
	{
		languageOptions: {
			parser: tseslint.parser,
			globals: { ...globals.node, ...globals.browser },
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			}
		},
		plugins: {
			sql: sqlPlugin,
			"sql-template": sqlTemplatePlugin,
			sqlite: sqlitePlugin,
			"typeorm-typescript": typeormTypescriptPlugin
		},
		files: ["src/**/*.ts", "src/**/*.tsx", "react-admin/**/*.ts", "react-admin/**/*.tsx"],
		rules: {
			complexity: ["error", 8],
			"max-lines-per-function": [
				"error",
				{ max: 50, skipBlankLines: true, skipComments: true }
			],
			"max-params": ["error", 5],
			"max-depth": ["error", 4],
			"max-lines": [
				"error",
				{ max: 300, skipBlankLines: true, skipComments: true }
			],

			"@typescript-eslint/restrict-template-expressions": [
				"error",
				{
					allowNumber: true,
					allowBoolean: true,
					allowNullish: false,
					allowAny: false,
					allowRegExp: false
				}
			],
			"@typescript-eslint/ban-ts-comment": [
				"error",
				{
					"ts-ignore": true,
					"ts-nocheck": true,
					"ts-expect-error": true,
					"ts-check": true
				}
			],
			"@eslint-community/eslint-comments/no-use": "error",
			"@eslint-community/eslint-comments/no-unlimited-disable": "error",
			"@eslint-community/eslint-comments/disable-enable-pair": "error",
			"@eslint-community/eslint-comments/no-unused-disable": "error",
			"no-restricted-syntax": [
				"error",
				{
					selector: "TSUnknownKeyword",
					message: "Запрещено 'unknown'."
				},
				{
					selector: "SwitchStatement",
					message: [
						"Switch statements are forbidden in functional programming paradigm.",
						"How to fix: Use ts-pattern match() instead.",
						"Example:",
						"  import { match } from 'ts-pattern';",
						"  type Item = { type: 'this' } | { type: 'that' };",
						"  const result = match(item)",
						"    .with({ type: 'this' }, (it) => processThis(it))",
						"    .with({ type: 'that' }, (it) => processThat(it))",
						"    .exhaustive();"
					].join("\n")
				},
				{
					selector: 'CallExpression[callee.name="require"]',
					message: "Avoid using require(). Use ES6 imports instead."
				},
				{
					selector: "ThrowStatement > Literal:not([value=/^\\w+Error:/])",
					message: 'Do not throw string literals or non-Error objects. Throw new Error("...") instead.'
				},
				{
					selector:
						"FunctionDeclaration[async=true], FunctionExpression[async=true], ArrowFunctionExpression[async=true]",
					message: "Запрещён async/await — используй Effect.gen / Effect.tryPromise."
				},
				{
					selector: "NewExpression[callee.name='Promise']",
					message: "Запрещён new Promise — используй Effect.async / Effect.tryPromise."
				},
				{
					selector: "CallExpression[callee.object.name='Promise']",
					message: "Запрещены Promise.* — используй комбинаторы Effect (all, forEach, etc.)."
				}
			],
			"@typescript-eslint/no-restricted-types": [
				"error",
				{
					types: {
						unknown: {
							message: "Не используем 'unknown'. Уточни тип или наведи порядок в источнике данных."
						},
						Promise: {
							message: "Запрещён Promise — используй Effect.Effect<A, E, R>.",
							suggest: ["Effect.Effect"]
						},
						"Promise<*>": {
							message: "Запрещён Promise<T> — используй Effect.Effect<T, E, R>.",
							suggest: ["Effect.Effect<T, E, R>"]
						}
					}
				}
			],
			"@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
			"no-throw-literal": "off",
			"@typescript-eslint/only-throw-error": [
				"error",
				{ allowThrowingUnknown: false, allowThrowingAny: false }
			],

			// SQL safety and formatting
			"sql/no-unsafe-query": [
				"error",
				{ allowLiteral: false, sqlTag: "sql" }
			],
			"sql/format": [
				"warn",
				{
					ignoreExpressions: false,
					ignoreInline: true,
					ignoreStartWithNewLine: true,
					ignoreTagless: true,
					retainBaseIndent: true,
					sqlTag: "sql"
				},
				{
					keywordCase: "upper",
					tabWidth: 2
				}
			],
			"sql-template/no-unsafe-query": "error",
			"sqlite/valid-query": "error",
			"sqlite/typed-input": "error",
			"sqlite/typed-result": "error",
			"typeorm-typescript/enforce-column-types": [
				"error",
				{ driver: "postgres" }
			],
			"typeorm-typescript/enforce-consistent-nullability": "error",
			"typeorm-typescript/enforce-relation-types": "error"
		}
	},
	{
		files: ["**/*.{test,spec}.{ts,tsx}", "tests/**", "**/__tests__/**"],
		...vitest.configs.all,
		languageOptions: {
			globals: {
				...vitest.environments.env.globals
			}
		},
		rules: {
			// Allow eslint-disable/enable comments in test files for fine-grained control
			"@eslint-community/eslint-comments/no-use": "off",
			// Disable line count limit for E2E tests that contain multiple test cases
			"max-lines-per-function": "off"
		}
	},

	// 4) React + JSX + a11y + hooks
	{
		files: [
			"**/*.tsx",
			"**/*.jsx",
			"react-admin/**/*.{ts,tsx,jsx,js}"
		],
		plugins: {
			react: reactPlugin,
			"react-hooks": reactHooksPlugin,
			"jsx-a11y": jsxA11y
		},
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			},
			globals: { ...globals.browser, ...globals.node }
		},
		settings: {
			react: { version: "detect" }
		},
		rules: {
			...reactPlugin.configs.recommended.rules,
			...jsxA11y.configs.recommended.rules,
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "error",
			"react/react-in-jsx-scope": "off",
			"react/prop-types": "off"
		}
	},

	// 4) Глобальные игноры
	{ ignores: ["dist/**", "build/**", "coverage/**"] }
);
