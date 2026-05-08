const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-class-assign");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Reassigning a defined class is dangerous! Consider renaming or creating a new variable!";
}

module.exports = ogRule;
