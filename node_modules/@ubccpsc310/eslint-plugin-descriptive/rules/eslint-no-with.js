const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-with");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension: The `with` statement is potentially problematic because it adds members of an object to the current scope, making it impossible to tell what a variable inside the block actually refers to.";
}

module.exports = ogRule;
