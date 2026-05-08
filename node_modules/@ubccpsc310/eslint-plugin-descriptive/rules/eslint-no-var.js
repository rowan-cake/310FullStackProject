const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-var");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Evolution: Variables declared using `var` can be accidentally redeclared which may result in unintended behaviour.";
}

module.exports = ogRule;
