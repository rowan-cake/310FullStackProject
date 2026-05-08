const eslintCopy = require("eslint/use-at-your-own-risk");
const rules = eslintCopy.builtinRules;
const ogRule = rules.get("no-loss-of-precision");
for (const key in ogRule.meta.messages) {
    const ogMessage = ogRule.meta.messages[key];
    let result = ogMessage;
    if (ogMessage.endsWith(".")) {
        result = result.substring(0, result.length - 1) + " " + "due to 64-bit floating-point rounding. Reason: Error Avoidance";
    }
    ogRule.meta.messages[key] = result;
}

module.exports = ogRule;
