"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabaseStore = initDatabaseStore;
exports.readDB = readDB;
exports.writeDB = writeDB;
const promises_1 = __importDefault(require("fs/promises"));
let dataDir;
async function initDatabaseStore(datadir) {
    dataDir = datadir;
    await promises_1.default.mkdir(datadir, { recursive: true });
}
function requireDataDir() {
    if (!dataDir) {
        throw new Error("databaseStore not initialized");
    }
    return dataDir;
}
async function readDB() {
    const dir = requireDataDir();
    try {
        const raw = await promises_1.default.readFile(`${dir}/database.json`, "utf8");
        const parsed = JSON.parse(raw);
        return {
            courses: parsed.courses ?? {},
            buildings: parsed.buildings ?? {},
        };
    }
    catch (err) {
        if (err?.code === "ENOENT") {
            return { courses: {}, buildings: {} };
        }
        throw err;
    }
}
async function writeDB(database) {
    const dir = requireDataDir();
    await promises_1.default.writeFile(`${dir}/database.json`, JSON.stringify(database), "utf8");
}
//# sourceMappingURL=databaseStore.js.map