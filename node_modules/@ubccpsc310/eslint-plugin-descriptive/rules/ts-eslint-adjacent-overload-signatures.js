const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["adjacent-overload-signatures"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] = "All overloaded {{name}} signatures should be adjacent to collocate relatable code and reduce confusion. Reason: Code Comprehension";
}

module.exports = ogRule;
