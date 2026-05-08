const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("max-lines-per-function");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Design Violation: Long functions indicate that too much is happening in one function, and make it harder to unit test. Consider refactoring your function into smaller, atomic ones!";
}

module.exports = ogRule;
