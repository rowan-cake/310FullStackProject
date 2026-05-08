const tsEslintCopy = require("@typescript-eslint/eslint-plugin");
const ogRule = tsEslintCopy.rules["promise-function-async"];
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Comprehension: Annotating a function as `async` allows it to better capture its usage by other code!";
}

module.exports = ogRule;
