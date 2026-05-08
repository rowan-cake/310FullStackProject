const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-eval");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Bad actors can inject arbirtary code into an `eval`!";
}

module.exports = ogRule;
