const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-constant-condition");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Expression {{expr}} is a constant instead of a condition and is likely not ready for production!";
}

module.exports = ogRule;
