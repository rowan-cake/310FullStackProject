const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-delete-var");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: The purpose of the `delete` operator is to remove a property from an object. Using the `delete` operator on a variable might lead to unexpected behavior.";
}

module.exports = ogRule;
