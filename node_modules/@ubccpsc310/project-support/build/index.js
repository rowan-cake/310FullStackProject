"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = exports.folderTest = void 0;
var folderTest_1 = require("./folderTest/folderTest");
Object.defineProperty(exports, "folderTest", { enumerable: true, get: function () { return folderTest_1.folderTest; } });
var Log_1 = __importDefault(require("./logger/Log"));
exports.Log = Log_1.default;
