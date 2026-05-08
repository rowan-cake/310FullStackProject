const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["naming-convention"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Consistency/Style";
}

module.exports = ogRule;
