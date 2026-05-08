const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("prefer-const");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension: Using specific, descriptive assigners makes it easier for others to understand what is going on!";
}

module.exports = ogRule;
