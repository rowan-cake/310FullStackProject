const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("max-lines");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Design Violation: Long files make it harder to find code in a project, and may indicate that too much is being handled in one file. Consider splitting this file's contents into smaller groups with similar functionality!";
}

module.exports = ogRule;
