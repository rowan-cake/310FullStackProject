const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-unsafe-finally");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: JavaScript suspends the control flow statements of `try` and `catch` blocks until the execution of `finally` block finishes. So, when `return`, `throw`, `break`, or `continue` is used in `finally`, control flow statements inside `try` and `catch` are overwritten, which is considered as unexpected behavior";
}

module.exports = ogRule;
