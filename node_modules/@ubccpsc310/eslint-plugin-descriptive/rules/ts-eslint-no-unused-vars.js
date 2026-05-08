const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["no-unused-vars"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Bloat: Variables that are declared and not used anywhere in the code are most likely an error due to incomplete refactoring. Such variables take up space in the code and can lead to confusion by readers.";
}

module.exports = ogRule;
