const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-duplicate-case");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: If a `switch` statement has duplicate test expressions in case clauses, it is likely that a programmer copied a `case` clause but forgot to change the test expression.";
}

module.exports = ogRule;
