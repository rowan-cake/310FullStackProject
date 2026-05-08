const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-throw-literal");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: throws are meant to throw only `Error` types, since catchers assume `Error` types only.";
}

module.exports = ogRule;
