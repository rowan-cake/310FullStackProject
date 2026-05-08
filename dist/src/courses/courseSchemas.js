"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCourseBody = parseCourseBody;
exports.parseCourseListPagination = parseCourseListPagination;
const InvalidRequestParametersError_1 = require("../errors/InvalidRequestParametersError");
const ValidationError_1 = require("../errors/ValidationError");
function parseCourseBody(body) {
    const fields = {};
    const requiredFields = {
        title: "string",
        dept: "string",
        code: "string",
    };
    for (const [field] of Object.entries(requiredFields)) {
        const value = body?.[field];
        if (value === undefined || value === null) {
            fields[field] = "required but missing";
        }
        else if (typeof value !== "string") {
            fields[field] = "expected a string";
        }
    }
    if (Object.keys(fields).length > 0) {
        throw new ValidationError_1.ValidationError(fields);
    }
    return {
        title: body.title,
        dept: body.dept,
        code: body.code,
    };
}
function parseCourseListPagination(query) {
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
//# sourceMappingURL=courseSchemas.js.map