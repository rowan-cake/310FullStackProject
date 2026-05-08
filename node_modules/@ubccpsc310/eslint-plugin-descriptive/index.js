function safeRequire(obj) {
	const result = {};
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			const path = obj[key];
			try {
				const pkg = require(path);
				result[key] = pkg;
			} catch {
				console.warn(`could not import ${key}`)
			}
		}
	}
	return result;
}

const plugin = {
    configs: {
		"all": require("./configs/all.js"),
		"recommended": require("./configs/recommended.js"),
	},
    rules: {
        "no-console": "./rules/eslint-no-console.js",
		"no-empty-function": "./rules/ts-eslint-no-empty-function.js",
		"no-inferrable-types": "./rules/ts-eslint-no-inferrable-types.js",
		"no-unused-vars": "./rules/ts-eslint-no-unused-vars.js",
		"no-empty-static-block": "./rules/eslint-no-empty-static-block.js",
		"no-self-assign": "./rules/eslint-no-self-assign.js",
		"no-unused-expressions": "./rules/eslint-no-unused-expressions.js",
		"no-unused-private-class-members": "./rules/eslint-no-unused-private-class-members.js",
		"no-useless-catch": "./rules/eslint-no-useless-catch.js",
		"prefer-optional-chain": "./rules/ts-eslint-prefer-optional-chain.js",
		"promise-function-async": "./rules/ts-eslint-promise-function-async.js",
		"adjacent-overload-signatures": "./rules/ts-eslint-adjacent-overload-signatures.js",
		"explicit-function-return-type": "./rules/ts-eslint-explicit-function-return-type.js",
		"no-confusing-non-null-assertion": "./rules/ts-eslint-no-confusing-non-null-assertion.js",
		"for-direction": "./rules/eslint-for-direction.js",
		"max-len": "./rules/eslint-max-len.js",
		"max-nested-callbacks": "./rules/eslint-max-nested-callbacks.js",
		"max-statements-per-line": "./rules/eslint-max-statements-per-line.js",
		"no-async-promise-executor": "./rules/eslint-no-async-promise-executor.js",
		"no-bitwise": "./rules/eslint-no-bitwise.js",
		"no-extra-boolean-cast": "./rules/eslint-no-extra-boolean-cast.js",
		"no-nonoctal-decimal-escape": "./rules/eslint-no-nonoctal-decimal-escape.js",
		"no-octal": "./rules/eslint-no-octal.js",
		"no-regex-spaces": "./rules/eslint-no-regex-spaces.js",
		"no-useless-backreference": "./rules/eslint-no-useless-backreference.js",
		"no-useless-escape": "./rules/eslint-no-useless-escape.js",
		"no-with": "./rules/eslint-no-with.js",
		"prefer-const": "./rules/eslint-prefer-const.js",
		"dot-notation": "./rules/eslint-dot-notation.js",
		"array-type": "./rules/ts-eslint-array-type.js",
		"ban-tslint-comment": "./rules/ts-eslint-ban-tslint-comment.js",
		"consistent-generic-constructors": "./rules/ts-eslint-consistent-generic-constructors.js",
		"consistent-indexed-object-style": "./rules/ts-eslint-consistent-indexed-object-style.js",
		"consistent-type-assertions": "./rules/ts-eslint-consistent-type-assertions.js",
		"consistent-type-definitions": "./rules/ts-eslint-consistent-type-definitions.js",
		"naming-convention": "./rules/ts-eslint-naming-convention.js",
		"prefer-for-of": "./rules/ts-eslint-prefer-for-of.js",
		"prefer-function-type": "./rules/ts-eslint-prefer-function-type.js",
		"unified-signatures": "./rules/ts-eslint-unified-signatures.js",
		"prefer-spread": "./rules/eslint-prefer-spread.js",
		"await-thenable": "./rules/ts-eslint-await-thenable.js",
		"no-magic-numbers": "./rules/eslint-no-magic-numbers.js",
		// "require-await": "./rules/eslint-require-await.js",
		"no-shadow": "./rules/ts-eslint-no-shadow.js",
		"curly": "./rules/eslint-curly.js",
		"no-fallthrough": "./rules/eslint-no-fallthrough.js",
		"no-prototype-builtins": "./rules/eslint-no-prototype-builtins.js",
		"no-shadow-restricted-names": "./rules/eslint-no-shadow-restricted-names.js",
		"no-unsafe-optional-chaining": "./rules/eslint-no-unsafe-optional-chaining.js",
		"no-var": "./rules/eslint-no-var.js",
		"explicit-member-accessibility": "./rules/ts-eslint-explicit-member-accessibility.js",
		"max-lines": "./rules/eslint-max-lines.js",
		"max-lines-per-function": "./rules/eslint-max-lines-per-function.js",
		"no-global-assign": "./rules/eslint-no-global-assign.js",
		"no-for-in-array": "./rules/ts-eslint-no-for-in-array.js",
		// "prefer-find": "./rules/ts-eslint-prefer-find.js",
		"no-labels": "./rules/eslint-no-labels.js",
		"no-floating-promises": "./rules/ts-eslint-no-floating-promises.js",
		"no-misused-promises": "./rules/ts-eslint-no-misused-promises.js",
		"eqeqeq": "./rules/eslint-eqeqeq.js",
		"no-await-in-loop": "./rules/eslint-no-await-in-loop.js",
		"no-case-declarations": "./rules/eslint-no-case-declarations.js",
		"no-class-assign": "./rules/eslint-no-class-assign.js",
		"no-compare-neg-zero": "./rules/eslint-no-compare-neg-zero.js",
		"no-cond-assign": "./rules/eslint-no-cond-assign.js",
		"no-constant-binary-expression": "./rules/eslint-no-constant-binary-expression.js",
		"no-constant-condition": "./rules/eslint-no-constant-condition.js",
		"no-control-regex": "./rules/eslint-no-control-regex.js",
		"no-debugger": "./rules/eslint-no-debugger.js",
		"no-delete-var": "./rules/eslint-no-delete-var.js",
		"no-dupe-else-if": "./rules/eslint-no-dupe-else-if.js",
		"no-duplicate-case": "./rules/eslint-no-duplicate-case.js",
		"no-empty": "./rules/eslint-no-empty.js",
		"no-empty-character-class": "./rules/eslint-no-empty-character-class.js",
		"no-empty-pattern": "./rules/eslint-no-empty-pattern.js",
		"no-eval": "./rules/eslint-no-eval.js",
		"no-ex-assign": "./rules/eslint-no-ex-assign.js",
		"no-invalid-regexp": "./rules/eslint-no-invalid-regexp.js",
		"no-loss-of-precision": "./rules/eslint-no-loss-of-precision.js",
		"no-misleading-character-class": "./rules/eslint-no-misleading-character-class.js",
		"no-throw-literal": "./rules/eslint-no-throw-literal.js",
		"no-unsafe-finally": "./rules/eslint-no-unsafe-finally.js",
		"no-unused-labels": "./rules/eslint-no-unused-labels.js",
		"radix": "./rules/eslint-radix.js",
		"use-isnan": "./rules/eslint-use-isnan.js",
    }
};

plugin.rules = safeRequire(plugin.rules)

module.exports = plugin;
