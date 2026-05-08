const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["explicit-member-accessibility"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Design Violation: Accessibliity modifiers help comprehension and evolution, and enforce interface design!";
}

module.exports = ogRule;
