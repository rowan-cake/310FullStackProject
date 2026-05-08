"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.folderTest = void 0;
var chai_1 = require("chai");
var Options_1 = require("./Options");
var readTestsFromDisk_1 = require("./readTestsFromDisk");
var validateTests_1 = require("./validateTests");
function folderTest(suiteName, target, folder, options) {
    if (options === void 0) { options = {}; }
    var mergedOptions = (0, Options_1.joinWithDefaultOptions)(options);
    var tests;
    try {
        var maybeTests = (0, readTestsFromDisk_1.readTestsFromDisk)(folder);
        if ((0, validateTests_1.validateTests)(maybeTests, mergedOptions)) {
            tests = maybeTests;
        }
    }
    catch (err) {
        chai_1.expect.fail("", "", "Failed to read one or more test queries. ".concat(err));
    }
    // Dynamically create and run a test for each query in testQueries
    return describe(suiteName, function () {
        var e_1, _a;
        var _loop_1 = function (test_1) {
            it("[".concat(test_1.filename, "] ").concat(test_1.title), function () {
                return __awaiter(this, void 0, void 0, function () {
                    var result, supplement, err_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, target(test_1.input)];
                            case 1:
                                result = _a.sent();
                                if (test_1.errorExpected) {
                                    supplement = test_1.verbose ? " with ".concat(result) : "";
                                    return [2 /*return*/, Promise.reject(new Error("Expected an error but instead resolved or returned".concat(supplement)))];
                                }
                                else if (test_1.expected !== undefined) {
                                    return [2 /*return*/, mergedOptions.assertOnResult(result, test_1.expected, test_1.input)];
                                }
                                return [3 /*break*/, 3];
                            case 2:
                                err_1 = _a.sent();
                                if (!test_1.errorExpected) {
                                    // if we don't want an error just rethrow
                                    throw err_1;
                                }
                                else if (test_1.expected !== undefined) {
                                    return [2 /*return*/, mergedOptions.assertOnError(err_1, test_1.expected, test_1.input)];
                                }
                                return [3 /*break*/, 3];
                            case 3: return [2 /*return*/];
                        }
                    });
                });
            });
        };
        try {
            for (var tests_1 = __values(tests), tests_1_1 = tests_1.next(); !tests_1_1.done; tests_1_1 = tests_1.next()) {
                var test_1 = tests_1_1.value;
                _loop_1(test_1);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (tests_1_1 && !tests_1_1.done && (_a = tests_1.return)) _a.call(tests_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    });
}
exports.folderTest = folderTest;
