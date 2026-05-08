const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["consistent-type-definitions"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Consistency/Style";
}

module.exports = ogRule;
