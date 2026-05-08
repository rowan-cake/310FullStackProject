const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("for-direction");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension: A `for` loop with a stop condition that can never be reached, such as one with a counter that moves in the wrong direction, will run infinitely. If this is intended, use a `while` loop instead. If not, double check that your stop condition will be met!";
}

module.exports = ogRule;
