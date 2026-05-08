"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSectionBody = parseSectionBody;
exports.parseSectionListPagination = parseSectionListPagination;
const InvalidRequestParametersError_1 = require("../errors/InvalidRequestParametersError");
const ValidationError_1 = require("../errors/ValidationError");
function parseSectionBody(body) {
    const fields = {};
    const requiredFields = ["instructor", "year", "avg", "pass", "fail", "audit"];
    for (const field of requiredFields) {
        const value = body?.[field];
        if (value === undefined || value === null) {
            fields[field] = "required but missing";
        }
    }
    const instructor = body?.instructor;
    if (!fields.instructor && typeof instructor !== "string") {
        fields.instructor = "expected a string";
    }
    const year = body?.year;
    if (!fields.year && (!Number.isFinite(year) || !Number.isInteger(year) || year < 1900 || year > 2099)) {
        fields.year = "expected a number between 1900 and 2099";
    }
    const avg = body?.avg;
    if (!fields.avg && (!Number.isFinite(avg) || avg < 0 || avg > 100)) {
        fields.avg = "expected a number between 0 and 100";
    }
    const pass = body?.pass;
    if (!fields.pass && (!Number.isFinite(pass) || !Number.isInteger(pass) || pass < 0)) {
        fields.pass = "expected a number >= 0";
    }
    const fail = body?.fail;
    if (!fields.fail && (!Number.isFinite(fail) || !Number.isInteger(fail) || fail < 0)) {
        fields.fail = "expected a number >= 0";
    }
    const audit = body?.audit;
    if (!fields.audit && (!Number.isFinite(audit) || !Number.isInteger(audit) || audit < 0)) {
        fields.audit = "expected a number >= 0";
    }
    if (Object.keys(fields).length > 0) {
        throw new ValidationError_1.ValidationError(fields);
    }
    return {
        instructor: body.instructor,
        year: body.year,
        avg: body.avg,
        pass: body.pass,
        fail: body.fail,
        audit: body.audit,
    };
}
function parseSectionListPagination(query) {
    const params = {};
    const limitRaw = query?.limit;
    const offsetRaw = query?.offset;
    let limit = 100;
    if (limitRaw !== undefined) {
        limit = /^\d+$/.test(`${limitRaw}`) ? Number.parseInt(`${limitRaw}`, 10) : NaN;
    }
    let offset = 0;
    if (offsetRaw !== undefined) {
        offset = /^\d+$/.test(`${offsetRaw}`) ? Number.parseInt(`${offsetRaw}`, 10) : NaN;
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
        params.limit = "expected an integer between 1 and 5000";
    }
    if (!Number.isInteger(offset) || offset < 0) {
        params.offset = "expected an integer >= 0";
    }
    if (Object.keys(params).length > 0) {
        throw new InvalidRequestParametersError_1.InvalidRequestParametersError(params);
    }
    return { limit, offset };
}
//# sourceMappingURL=sectionSchemas.js.map