const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["await-thenable"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Evolution: Though not a functional defect, `await`ing a non-Promise is confusing because it implies the non-Promise value is actually a promise!";
}

module.exports = ogRule;
