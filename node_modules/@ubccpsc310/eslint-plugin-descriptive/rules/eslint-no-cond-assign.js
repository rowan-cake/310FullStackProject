const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-cond-assign");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Did you meant to compare but type `=` instead of `===`?";
}

module.exports = ogRule;
