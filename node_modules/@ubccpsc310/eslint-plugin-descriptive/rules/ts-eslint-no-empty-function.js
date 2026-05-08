const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["no-empty-function"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Bloat";
}

module.exports = ogRule;
