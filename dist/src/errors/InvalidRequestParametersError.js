"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidRequestParametersError = void 0;
class InvalidRequestParametersError extends Error {
    params;
    constructor(params) {
        super("Invalid request parameters");
        this.name = "InvalidRequestParametersError";
        this.params = params;
    }
}
exports.InvalidRequestParametersError = InvalidRequestParametersError;
//# sourceMappingURL=InvalidRequestParametersError.js.map