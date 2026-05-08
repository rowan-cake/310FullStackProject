"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTestsFromDisk = void 0;
var Log_1 = __importDefault(require("../logger/Log"));
var fs = __importStar(require("fs-extra"));
function attemptDirRead(currentPath) {
    try {
        return fs.readdirSync(currentPath);
    }
    catch (err) {
        Log_1.default.error("Error reading directory ".concat(currentPath));
        throw err;
    }
}
// From https://stackoverflow.com/questions/15630770/node-js-check-if-path-is-file-or-directory
function isDirectory(path) {
    try {
        var stat = fs.lstatSync(path);
        return stat.isDirectory();
    }
    catch (e) {
        return false;
    }
}
function readAllFiles(currentPath) {
    var e_1, _a;
    var filePaths = [];
    var filesInDir = attemptDirRead(currentPath);
    try {
        for (var filesInDir_1 = __values(filesInDir), filesInDir_1_1 = filesInDir_1.next(); !filesInDir_1_1.done; filesInDir_1_1 = filesInDir_1.next()) {
            var fileOrDirName = filesInDir_1_1.value;
            var fullPath = "".concat(currentPath, "/").concat(fileOrDirName);
            if (isDirectory(fullPath)) {
                filePaths = filePaths.concat(readAllFiles(fullPath));
            }
            else if (/\.json$/i.test(fileOrDirName)) {
                filePaths.push(fullPath);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (filesInDir_1_1 && !filesInDir_1_1.done && (_a = filesInDir_1.return)) _a.call(filesInDir_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return filePaths;
}
/**
 * Recursively searches for test query JSON files in the path and returns those matching the specified schema.
 * @param path The path to the sample query JSON files.
 */
function readTestsFromDisk(path) {
    var e_2, _a;
    var methodName = "readTestsFromDisk() --";
    var testsLoaded = [];
    var files;
    try {
        files = readAllFiles(path);
        if (files.length === 0) {
            Log_1.default.warn("".concat(methodName, " No folder-test files found in ").concat(path, "."));
        }
    }
    catch (err) {
        Log_1.default.error("".concat(methodName, " Exception reading files in ").concat(path, "."));
        throw err;
    }
    try {
        for (var files_1 = __values(files), files_1_1 = files_1.next(); !files_1_1.done; files_1_1 = files_1.next()) {
            var file = files_1_1.value;
            var content = void 0;
            try {
                content = fs.readFileSync(file);
            }
            catch (err) {
                Log_1.default.error("".concat(methodName, " Could not read ").concat(file, "."));
                throw err;
            }
            try {
                var test_1 = JSON.parse(content.toString());
                test_1.filename = file.replace("".concat(path, "/"), ""); // dont show absolute paths
                testsLoaded.push(test_1);
            }
            catch (err) {
                Log_1.default.error("".concat(methodName, " ").concat(file, " could not be read and parsed."));
                throw new Error("In ".concat(file, " ").concat(err.message));
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (files_1_1 && !files_1_1.done && (_a = files_1.return)) _a.call(files_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return testsLoaded;
}
exports.readTestsFromDisk = readTestsFromDisk;
