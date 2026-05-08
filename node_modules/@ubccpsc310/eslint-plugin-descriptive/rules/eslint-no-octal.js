const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-octal");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension: They are confusing.";
}

module.exports = ogRule;
