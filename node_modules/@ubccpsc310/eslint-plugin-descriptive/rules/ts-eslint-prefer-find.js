const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["prefer-find"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: Using `.find()` is safer than `.filter()` because it avoids a magic and potentially unsafe array access!";
}

module.exports = ogRule;
