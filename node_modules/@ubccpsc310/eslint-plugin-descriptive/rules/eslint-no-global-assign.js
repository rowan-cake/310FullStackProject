const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-global-assign");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Design Violation";
}

module.exports = ogRule;
