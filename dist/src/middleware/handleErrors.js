"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleErrors = handleErrors;
const NotFoundError_1 = require("../errors/NotFoundError");
const ValidationError_1 = require("../errors/ValidationError");
const InvalidRequestParametersError_1 = require("../errors/InvalidRequestParametersError");
function handleErrors(err, _req, res, _next) {
    if (err instanceof ValidationError_1.ValidationError) {
        res.status(422).json({
            error: "Validation failed",
            fields: err.fields,
        });
        return;
    }
    if (err instanceof InvalidRequestParametersError_1.InvalidRequestParametersError) {
        res.status(400).json({
            error: "Invalid request parameters",
            params: err.params,
        });
        return;
    }
    if (err instanceof NotFoundError_1.NotFoundError) {
        res.status(404).json({
            error: "Not found",
            message: err.message,
        });
        return;
    }
    res.status(500).json({ error: "Internal server error" });
}
//# sourceMappingURL=handleErrors.js.map