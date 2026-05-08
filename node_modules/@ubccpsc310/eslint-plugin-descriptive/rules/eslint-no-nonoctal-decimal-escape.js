const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-nonoctal-decimal-escape");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension";
}

module.exports = ogRule;
