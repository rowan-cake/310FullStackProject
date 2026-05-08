const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["no-inferrable-types"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Bloat";
}

module.exports = ogRule;
