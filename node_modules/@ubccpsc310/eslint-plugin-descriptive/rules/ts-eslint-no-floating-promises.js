const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["no-floating-promises"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Error Avoidance: A floating `Promise` is one that is created without any code set up to handle any errors it might throw. Floating promises can cause several issues, such as improperly sequenced operations, ignored `Promise` rejections, and more.";
}

module.exports = ogRule;
