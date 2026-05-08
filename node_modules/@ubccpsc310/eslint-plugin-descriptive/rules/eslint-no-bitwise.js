const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-bitwise");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension: Bitwise operators are very rare. Did you mean to use a logical operator?";
}

module.exports = ogRule;
