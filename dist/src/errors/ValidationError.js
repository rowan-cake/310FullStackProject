"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
class ValidationError extends Error {
    fields;
    constructor(fields) {
        super("Validation failed");
        this.name = "ValidationError";
        this.fields = fields;
    }
}
exports.ValidationError = ValidationError;
//# sourceMappingURL=ValidationError.js.map