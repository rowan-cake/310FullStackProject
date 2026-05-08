const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-useless-catch");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Bloat: A `catch` clause that only rethrows the original error is redundant, and has no effect on the runtime behavior of the program.";
}

module.exports = ogRule;
