const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-debugger");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: This will cause your code to stop executing in production. Use your IDE's debugger to set a breakpoint instead!";
}

module.exports = ogRule;
