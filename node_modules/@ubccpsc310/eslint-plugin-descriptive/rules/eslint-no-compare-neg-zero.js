const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-compare-neg-zero");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Believe it or not, `-0` is different from `0` and results in unintuitive behaviour. Use `0` instead!";
}

module.exports = ogRule;
