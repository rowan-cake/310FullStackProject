const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-prototype-builtins");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Evolution: This may result in unintended behaviour and/or security vulnerabilities.";
}

module.exports = ogRule;
