const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("eqeqeq");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: `==` has unintuitive behaviour in javascript, so `===` is always used instead!";
}

module.exports = ogRule;
