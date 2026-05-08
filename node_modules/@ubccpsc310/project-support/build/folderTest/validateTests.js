"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTests = void 0;
var Log_1 = __importDefault(require("../logger/Log"));
var legalKeys = new Set(["title", "input", "errorExpected", "verbose", "expected", "filename"]);
function validateTest(content, options) {
    if (typeof content.title !== "string") {
        throw new Error("required property title is missing or is not a string.");
    }
    if (typeof content.input === "undefined") { // we don't validate input type
        throw new Error("required property input is missing.");
    }
    if (typeof content.errorExpected !== "undefined" && typeof content.errorExpected !== "boolean") {
        throw new Error("optional property errorExpected is not a boolean.");
    }
    if (typeof content.verbose !== "undefined" && typeof content.verbose !== "boolean") {
        throw new Error("optional property verbose is not a boolean.");
    }
    if (options.inputValidator && !options.inputValidator(content.input)) {
        throw new Error("input is not valid.");
    }
    if (typeof content.expected !== "undefined") {
        if (options.outputValidator && !content.errorExpected && !options.outputValidator(content.expected)) {
            throw new Error("output is not valid.");
        }
        if (options.errorValidator && content.errorExpected && !options.errorValidator(content.expected)) {
            throw new Error("error is not valid.");
        }
    }
    if (options.checkForExcessKeys) {
        for (var key in content) {
            if (!legalKeys.has(key)) {
                throw new Error("extraneous key \"".concat(key, "\" is not valid"));
            }
        }
    }
}
function validateTests(maybeTests, options) {
    var e_1, _a;
    var badTests = 0;
    try {
        for (var maybeTests_1 = __values(maybeTests), maybeTests_1_1 = maybeTests_1.next(); !maybeTests_1_1.done; maybeTests_1_1 = maybeTests_1.next()) {
            var maybeTest = maybeTests_1_1.value;
            try {
                validateTest(maybeTest, options);
            }
            catch (err) {
                Log_1.default.error("".concat(maybeTest.filename, " does not conform to the test schema. (").concat(err.message, ")"));
                badTests++;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (maybeTests_1_1 && !maybeTests_1_1.done && (_a = maybeTests_1.return)) _a.call(maybeTests_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (badTests > 0) {
        var subject = badTests === 1 ? "test" : "tests";
        throw new Error("".concat(badTests, " ").concat(subject, " did not conform to the test schema."));
    }
    return true;
}
exports.validateTests = validateTests;
