"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = void 0;
class NotFoundError extends Error {
    resource;
    id;
    constructor(resource, id) {
        super(`no ${resource} with id '${id}'`);
        this.name = "NotFoundError";
        this.resource = resource;
        this.id = id;
    }
}
exports.NotFoundError = NotFoundError;
//# sourceMappingURL=NotFoundError.js.map