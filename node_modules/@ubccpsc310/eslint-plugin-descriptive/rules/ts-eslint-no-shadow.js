const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["no-shadow"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Evolution: Shadowing may cause unexpected or erroneous behaviour. Please rename one of the shadowed variables!";
}

module.exports = ogRule;
