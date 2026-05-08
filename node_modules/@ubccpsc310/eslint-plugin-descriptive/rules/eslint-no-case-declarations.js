const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-case-declarations");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Declaring in a switch block without brackets makes the variable visible beyond the scope of the switch case and may result in unintended behaviour.";
}

module.exports = ogRule;
