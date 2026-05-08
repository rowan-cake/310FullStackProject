const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-unused-private-class-members");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Bloat: Private class members that are declared and not used anywhere in the code are most likely an error due to incomplete refactoring. Such class members take up space in the code and can lead to confusion by readers.";
}

module.exports = ogRule;
