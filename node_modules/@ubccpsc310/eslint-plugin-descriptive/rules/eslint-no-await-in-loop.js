const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-await-in-loop");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Performing an `await` as part of each operation is an indication that the program is not taking full advantage of the parallelization benefits of `async`/`await`. The code should be refactored to create all the promises at once, then get access to the results using `Promise.all()`. Otherwise, each successive operation will not start until the previous one has completed.";
}

module.exports = ogRule;
