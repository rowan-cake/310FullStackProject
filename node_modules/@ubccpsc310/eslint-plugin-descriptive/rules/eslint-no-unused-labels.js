const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-unused-labels");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Labels that are declared and not used anywhere in the code are most likely an error due to incomplete refactoring.";
}

module.exports = ogRule;
