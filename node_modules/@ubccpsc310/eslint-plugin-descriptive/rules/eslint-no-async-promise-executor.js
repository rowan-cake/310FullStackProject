const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-async-promise-executor");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension: (1) If an async executor function throws an error, the error will be lost and won’t cause the newly-constructed `Promise` to reject. (2) or if the executor function is using `await`, consider if you actually need to construct a new `Promise` here!";
}

module.exports = ogRule;
