const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-empty-pattern");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: No new variables are created because `{}` is expected to contain the variables to create. If you wish to destructure an empty object, use the pattern `var {a = {}} = foo;` instead.";
}

module.exports = ogRule;
