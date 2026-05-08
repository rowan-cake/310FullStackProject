const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["explicit-function-return-type"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension: Explicit return types make it more clear to other developers what type is returned by a function.";
}

module.exports = ogRule;
