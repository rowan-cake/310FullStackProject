const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-self-assign");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Bloat: Self assignments have no effect, so this may be an error due to incomplete refactoring.";
}

module.exports = ogRule;
