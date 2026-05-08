const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("require-await");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Evolution: A function should only be annotated as `async` if it uses asynchronous features, such as `await`.";
}

module.exports = ogRule;
