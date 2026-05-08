const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("use-isnan");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Because `NaN` is unique in JavaScript by not being `=== `to anything, including itself, the results of comparisons to `NaN` are confusing";
}

module.exports = ogRule;
