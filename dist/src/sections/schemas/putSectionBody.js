"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePutSectionBody = validatePutSectionBody;
function validatePutSectionBody(body) {
    const errors = {};
    const requiredFields = ["instructor", "year", "avg", "pass", "fail", "audit"];
    for (const field of requiredFields) {
        const value = body[field];
        if (value === undefined || value === null) {
            errors[field] = "required but missing";
        }
    }
    const instructor = body.instructor;
    if (!errors.instructor && typeof instructor !== "string") {
        errors.instructor = "expected a string";
    }
    const year = body.year;
    if (!errors.year && (!Number.isFinite(year) || !Number.isInteger(year) || year < 1900 || year > 2099)) {
        errors.year = "expected a number between 1900 and 2099";
    }
    const avg = body.avg;
    if (!errors.avg && (!Number.isFinite(avg) || avg < 0 || avg > 100)) {
        errors.avg = "expected a number between 0 and 100";
    }
    const pass = body.pass;
    if (!errors.pass && (!Number.isFinite(pass) || !Number.isInteger(pass) || pass < 0)) {
        errors.pass = "expected a number >= 0";
    }
    const fail = body.fail;
    if (!errors.fail && (!Number.isFinite(fail) || !Number.isInteger(fail) || fail < 0)) {
        errors.fail = "expected a number >= 0";
    }
    const audit = body.audit;
    if (!errors.audit && (!Number.isFinite(audit) || !Number.isInteger(audit) || audit < 0)) {
        errors.audit = "expected a number >= 0";
    }
    return {
        error: "Validation failed",
        fields: errors,
    };
}
//# sourceMappingURL=putSectionBody.js.map