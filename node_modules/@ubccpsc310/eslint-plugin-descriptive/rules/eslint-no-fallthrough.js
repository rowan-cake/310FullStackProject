const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-fallthrough");
for (const key in ogRule.meta.messages) {
    ogRule.meta.messages[key] += " Reason: Code Evolution: Fall throughs are error prone. Either add a 'break' statement or add a '// falls through' comment to be explicit.";
}

module.exports = ogRule;
