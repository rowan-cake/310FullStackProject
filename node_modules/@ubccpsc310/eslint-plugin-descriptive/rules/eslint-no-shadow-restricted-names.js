const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-shadow-restricted-names");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Evolution: {{name}}' is a restricted keyword. Please rename your variable!";
}

module.exports = ogRule;
