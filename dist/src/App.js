"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const promises_1 = __importDefault(require("fs/promises"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const jszip_1 = __importDefault(require("jszip"));
const parse5 = __importStar(require("parse5"));
const decimal_js_1 = __importDefault(require("decimal.js"));
const courseRoutes_1 = __importDefault(require("./courses/courseRoutes"));
const sectionRoutes_1 = __importDefault(require("./sections/sectionRoutes"));
const handleErrors_1 = require("./middleware/handleErrors");
const databaseStore_1 = require("./storage/databaseStore");
async function createApp(config) {
    const app = (0, express_1.default)();
    const { datadir } = config;
    const geolocationLookup = config.geolocationLookup ??
        (async (address) => {
            const response = await fetch(`http://cs310.students.cs.ubc.ca:11316/api/v1/project_team005/${encodeURIComponent(address)}`);
            return (await response.json());
        });
    await (0, databaseStore_1.initDatabaseStore)(datadir);
    const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
    app.use(express_1.default.static("frontend/public"));
    app.use(express_1.default.json());
    app.use(express_1.default.raw({ type: "application/*", limit: "10mb" }));
    app.use((0, cors_1.default)());
    app.use(courseRoutes_1.default);
    app.use(sectionRoutes_1.default);
    function emptyStats(kind) {
        if (kind === "facilities") {
            return {
                buildings_added: 0,
                buildings_modified: 0,
                rooms_added: 0,
                rooms_modified: 0,
            };
        }
        return {
            files_total: 0,
            files_processed: 0,
            files_skipped: 0,
            courses_seen: 0,
            courses_added: 0,
            courses_modified: 0,
            sections_seen: 0,
            sections_added: 0,
            sections_modified: 0,
        };
    }
    async function readJobs(dir) {
        try {
            const raw = await promises_1.default.readFile(`${dir}/datasets.json`, "utf8");
            return JSON.parse(raw);
        }
        catch (err) {
            if (err?.code === "ENOENT") {
                return {};
            }
            throw err;
        }
    }
    async function writeJobs(dir, jobs) {
        await promises_1.default.writeFile(`${dir}/datasets.json`, JSON.stringify(jobs), "utf8");
    }
    async function setJob(dir, job) {
        const jobs = await readJobs(dir);
        jobs[job.id] = job;
        await writeJobs(dir, jobs);
    }
    function genUploadId() {
        return `upload_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    function isValidOfferingRecord(o) {
        if (typeof o !== "object" || o === null) {
            return false;
        }
        if (typeof o.id !== "number" || !Number.isFinite(o.id) || !Number.isInteger(o.id)) {
            return false;
        }
        for (const key of ["Course", "Title", "Professor", "Subject", "Section", "Year"]) {
            if (typeof o[key] !== "string") {
                return false;
            }
        }
        if (typeof o.Avg !== "number" || !Number.isFinite(o.Avg)) {
            return false;
        }
        for (const key of ["Pass", "Fail", "Audit"]) {
            if (typeof o[key] !== "number" || !Number.isFinite(o[key]) || !Number.isInteger(o[key]) || o[key] < 0) {
                return false;
            }
        }
        return true;
    }
    function sectionsEqual(a, b) {
        return (a.instructor === b.instructor &&
            a.year === b.year &&
            a.avg === b.avg &&
            a.pass === b.pass &&
            a.fail === b.fail &&
            a.audit === b.audit);
    }
    function roomsEqual(a, b) {
        return (a.number === b.number &&
            a.type === b.type &&
            a.furniture === b.furniture &&
            a.href === b.href &&
            a.seats === b.seats);
    }
    function buildingsEqual(a, b) {
        return a.name === b.name && a.address === b.address && a.lat === b.lat && a.lon === b.lon;
    }
    function getAttr(node, name) {
        return node?.attrs?.find((attr) => attr.name === name)?.value;
    }
    function hasClass(node, className) {
        const classAttr = getAttr(node, "class");
        return typeof classAttr === "string" && classAttr.split(/\s+/).includes(className);
    }
    function textContent(node) {
        if (!node) {
            return "";
        }
        if (node.nodeName === "#text") {
            return node.value ?? "";
        }
        const children = Array.isArray(node.childNodes) ? node.childNodes : [];
        return children.map((child) => textContent(child)).join("");
    }
    function findAll(node, predicate, acc = []) {
        if (!node) {
            return acc;
        }
        if (predicate(node)) {
            acc.push(node);
        }
        const children = Array.isArray(node.childNodes) ? node.childNodes : [];
        for (const child of children) {
            findAll(child, predicate, acc);
        }
        return acc;
    }
    function findFirst(node, predicate) {
        if (!node) {
            return undefined;
        }
        if (predicate(node)) {
            return node;
        }
        const children = Array.isArray(node.childNodes) ? node.childNodes : [];
        for (const child of children) {
            const found = findFirst(child, predicate);
            if (found) {
                return found;
            }
        }
        return undefined;
    }
    function directChildCellsByClass(row) {
        const out = {};
        const children = Array.isArray(row?.childNodes) ? row.childNodes : [];
        for (const child of children) {
            if (child?.tagName !== "td") {
                continue;
            }
            const classAttr = getAttr(child, "class");
            if (typeof classAttr !== "string") {
                continue;
            }
            for (const className of classAttr.split(/\s+/)) {
                if (!(className in out)) {
                    out[className] = child;
                }
            }
        }
        return out;
    }
    function validateBuildingRecord(record) {
        return (typeof record.name === "string" &&
            typeof record.address === "string" &&
            typeof record.lat === "number" &&
            Number.isFinite(record.lat) &&
            typeof record.lon === "number" &&
            Number.isFinite(record.lon));
    }
    function validateRoomRecord(parentBuilding, record) {
        return (record.building === parentBuilding &&
            typeof record.number === "string" &&
            typeof record.type === "string" &&
            typeof record.furniture === "string" &&
            typeof record.href === "string" &&
            typeof record.seats === "number" &&
            Number.isInteger(record.seats) &&
            record.seats >= 0);
    }
    async function failDatasetJob(job, message) {
        job.status = "failed";
        job.message = message;
        await setJob(datadir, job);
    }
    async function processCourseOfferingsDataset(job, zip) {
        const courseFiles = Object.values(zip.files).filter((file) => !file.dir && file.name.startsWith("courses/"));
        const hasCoursesDir = Boolean(zip.files["courses/"]);
        if (!hasCoursesDir && courseFiles.length === 0) {
            await failDatasetJob(job, "Missing root courses directory");
            return;
        }
        const stats = emptyStats("course_offerings");
        stats.files_total = courseFiles.length;
        const database = await (0, databaseStore_1.readDB)();
        const coursesAddedThisJob = new Set();
        const coursesModifiedThisJob = new Set();
        const sectionsAddedThisJob = new Set();
        const sectionsModifiedThisJob = new Set();
        const coursesSeenThisJob = new Set();
        const sectionsSeenThisJob = new Set();
        for (const file of courseFiles) {
            let parsed;
            try {
                parsed = JSON.parse(await file.async("string"));
            }
            catch {
                stats.files_skipped += 1;
                continue;
            }
            if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.result)) {
                stats.files_skipped += 1;
                continue;
            }
            stats.files_processed += 1;
            for (const rec of parsed.result) {
                if (!isValidOfferingRecord(rec)) {
                    continue;
                }
                const courseId = `${rec.Subject}${rec.Course}`;
                if (!coursesSeenThisJob.has(courseId)) {
                    stats.courses_seen += 1;
                    coursesSeenThisJob.add(courseId);
                }
                const yearStr = rec.Year.trim();
                const yearNum = /^\d+$/.test(yearStr) ? Number(yearStr) : NaN;
                if (rec.Section !== "overall" && !Number.isFinite(yearNum)) {
                    continue;
                }
                const titleYear = Number.isFinite(yearNum) ? yearNum : -Infinity;
                const sectionYear = rec.Section === "overall" ? 1900 : yearNum;
                let course = database.courses[courseId];
                if (!course) {
                    database.courses[courseId] = {
                        title: rec.Title,
                        dept: rec.Subject,
                        code: rec.Course,
                        sections: {},
                        titleYear,
                    };
                    course = database.courses[courseId];
                    stats.courses_added += 1;
                    coursesAddedThisJob.add(courseId);
                }
                else {
                    let changed = false;
                    if (course.dept !== rec.Subject) {
                        course.dept = rec.Subject;
                        changed = true;
                    }
                    if (course.code !== rec.Course) {
                        course.code = rec.Course;
                        changed = true;
                    }
                    const currentTitleYear = (course.titleYear ?? -Infinity);
                    if (titleYear >= currentTitleYear) {
                        if (course.title !== rec.Title) {
                            course.title = rec.Title;
                            changed = true;
                        }
                        course.titleYear = titleYear;
                    }
                    if (changed && !coursesAddedThisJob.has(courseId) && !coursesModifiedThisJob.has(courseId)) {
                        stats.courses_modified += 1;
                        coursesModifiedThisJob.add(courseId);
                    }
                }
                const sectionId = String(rec.id);
                const sectionKey = `${courseId}:${sectionId}`;
                if (!sectionsSeenThisJob.has(sectionKey)) {
                    stats.sections_seen += 1;
                    sectionsSeenThisJob.add(sectionKey);
                }
                const nextSection = {
                    instructor: rec.Professor,
                    year: sectionYear,
                    avg: rec.Avg,
                    pass: rec.Pass,
                    fail: rec.Fail,
                    audit: rec.Audit,
                };
                const existingSection = course.sections[sectionId];
                if (!existingSection) {
                    course.sections[sectionId] = nextSection;
                    stats.sections_added += 1;
                    sectionsAddedThisJob.add(sectionKey);
                }
                else {
                    if (!sectionsEqual(existingSection, nextSection) &&
                        !sectionsAddedThisJob.has(sectionKey) &&
                        !sectionsModifiedThisJob.has(sectionKey)) {
                        stats.sections_modified += 1;
                        sectionsModifiedThisJob.add(sectionKey);
                    }
                    course.sections[sectionId] = nextSection;
                }
            }
        }
        await (0, databaseStore_1.writeDB)(database);
        job.status = "completed";
        job.message = "Dataset processing complete";
        job.stats = stats;
        await setJob(datadir, job);
    }
    async function parseHtmlDocument(file) {
        try {
            return parse5.parse(await file.async("string"));
        }
        catch {
            return undefined;
        }
    }
    async function lookupGeolocation(address) {
        try {
            const geo = await geolocationLookup(address);
            if (geo?.error) {
                return undefined;
            }
            if (typeof geo?.lat !== "number" || !Number.isFinite(geo.lat)) {
                return undefined;
            }
            if (typeof geo?.lon !== "number" || !Number.isFinite(geo.lon)) {
                return undefined;
            }
            return geo;
        }
        catch {
            return undefined;
        }
    }
    async function processFacilitiesDataset(job, zip) {
        const indexFile = zip.file("index.htm");
        if (!indexFile) {
            await failDatasetJob(job, "Missing index.htm file");
            return;
        }
        const indexDoc = await parseHtmlDocument(indexFile);
        if (!indexDoc) {
            await failDatasetJob(job, "index.htm could not be parsed");
            return;
        }
        const buildingTable = findFirst(indexDoc, (node) => node?.tagName === "table" && hasClass(node, "views-table"));
        if (!buildingTable) {
            await failDatasetJob(job, "No building table found in index.htm");
            return;
        }
        const stats = emptyStats("facilities");
        const database = await (0, databaseStore_1.readDB)();
        for (const row of findAll(buildingTable, (node) => node?.tagName === "tr")) {
            const cells = directChildCellsByClass(row);
            const titleCell = cells["views-field-title"];
            const codeCell = cells["views-field-field-building-code"];
            const addressCell = cells["views-field-field-building-address"];
            const titleLink = findFirst(titleCell, (node) => node?.tagName === "a");
            if (!titleCell || !codeCell || !addressCell || !titleLink) {
                continue;
            }
            const name = textContent(titleLink).trim();
            const shortname = textContent(codeCell).trim();
            const address = textContent(addressCell).trim();
            const link = getAttr(titleLink, "href");
            if (!name || !shortname || !address || !link) {
                continue;
            }
            const geo = await lookupGeolocation(address);
            if (!geo) {
                continue;
            }
            const nextBuilding = { name, address, lat: geo.lat, lon: geo.lon };
            if (!validateBuildingRecord(nextBuilding)) {
                continue;
            }
            let building = database.buildings[shortname];
            if (!building) {
                building = { ...nextBuilding, rooms: {} };
                database.buildings[shortname] = building;
                stats.buildings_added += 1;
            }
            else if (!buildingsEqual(building, nextBuilding)) {
                building.name = nextBuilding.name;
                building.address = nextBuilding.address;
                building.lat = nextBuilding.lat;
                building.lon = nextBuilding.lon;
                stats.buildings_modified += 1;
            }
            const linkedFile = zip.file(link.replace(/^\.?\//, ""));
            if (!linkedFile) {
                continue;
            }
            const roomDoc = await parseHtmlDocument(linkedFile);
            if (!roomDoc) {
                continue;
            }
            const roomTable = findFirst(roomDoc, (node) => node?.tagName === "table" && hasClass(node, "views-table"));
            if (!roomTable) {
                continue;
            }
            for (const roomRow of findAll(roomTable, (node) => node?.tagName === "tr")) {
                const roomCells = directChildCellsByClass(roomRow);
                const numberLink = findFirst(roomCells["views-field-field-room-number"], (node) => node?.tagName === "a");
                const hrefLink = findFirst(roomCells["views-field-nothing"], (node) => node?.tagName === "a");
                const seatsText = textContent(roomCells["views-field-field-room-capacity"]).trim();
                const furniture = textContent(roomCells["views-field-field-room-furniture"]).trim();
                const type = textContent(roomCells["views-field-field-room-type"]).trim();
                const number = textContent(numberLink).trim();
                const href = getAttr(hrefLink, "href");
                const seats = /^\d+$/.test(seatsText) ? Number(seatsText) : NaN;
                const candidate = { building: shortname, number, type, furniture, href, seats };
                if (!numberLink || !hrefLink || !validateRoomRecord(shortname, candidate)) {
                    continue;
                }
                const roomId = `${shortname}_${number}`;
                const nextRoom = {
                    number,
                    type,
                    furniture,
                    href: href,
                    seats,
                };
                const existingRoom = building.rooms[roomId];
                if (!existingRoom) {
                    building.rooms[roomId] = nextRoom;
                    stats.rooms_added += 1;
                }
                else if (!roomsEqual(existingRoom, nextRoom)) {
                    building.rooms[roomId] = nextRoom;
                    stats.rooms_modified += 1;
                }
            }
        }
        await (0, databaseStore_1.writeDB)(database);
        job.status = "completed";
        job.message = "Dataset processing complete";
        job.stats = stats;
        await setJob(datadir, job);
    }
    async function processDataset(jobId, zipBuffer) {
        const jobs = await readJobs(datadir);
        const job = jobs[jobId];
        if (!job) {
            return;
        }
        let zip;
        try {
            zip = await jszip_1.default.loadAsync(zipBuffer);
        }
        catch {
            await failDatasetJob(job, "Data is not in a valid zip format");
            return;
        }
        if (job.kind === "facilities") {
            await processFacilitiesDataset(job, zip);
            return;
        }
        await processCourseOfferingsDataset(job, zip);
    }
    function buildingToResponseGETandPUT(buildingId, building) {
        return {
            id: buildingId,
            name: building.name,
            address: building.address,
            lat: building.lat,
            lon: building.lon,
            links: {
                self: `/api/v2/buildings/${buildingId}`,
                rooms: `/api/v2/buildings/${buildingId}/rooms`,
            },
        };
    }
    function roomToResponseGETandPUT(buildingId, roomId, room) {
        return {
            id: roomId,
            building: buildingId,
            number: room.number,
            type: room.type,
            furniture: room.furniture,
            href: room.href,
            seats: room.seats,
            links: {
                self: `/api/v2/buildings/${buildingId}/rooms/${roomId}`,
                building: `/api/v2/buildings/${buildingId}`,
            },
        };
    }
    function parsePagination(_req) {
        const params = {};
        const limitRaw = _req.query.limit;
        const offsetRaw = _req.query.offset;
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
            return { ok: false, body: { error: "Invalid request parameters", params } };
        }
        return { ok: true, limit, offset };
    }
    function sectionToResponseDEL(sectionId, section) {
        return {
            id: sectionId,
            instructor: section.instructor,
            year: section.year,
            avg: section.avg,
            pass: section.pass,
            fail: section.fail,
            audit: section.audit,
        };
    }
    function sectionToResponse422(_req) {
        const errors = {};
        const requiredFields = ["instructor", "year", "avg", "pass", "fail", "audit"];
        for (const field of requiredFields) {
            const value = _req.body[field];
            if (value === undefined || value === null) {
                errors[field] = "required but missing";
            }
        }
        const instructor = _req.body.instructor;
        if (!errors.instructor && typeof instructor !== "string") {
            errors.instructor = "expected a string";
        }
        const year = _req.body.year;
        if (!errors.year && (!Number.isFinite(year) || !Number.isInteger(year) || year < 1900 || year > 2099)) {
            errors.year = "expected a number between 1900 and 2099";
        }
        const avg = _req.body.avg;
        if (!errors.avg && (!Number.isFinite(avg) || avg < 0 || avg > 100)) {
            errors.avg = "expected a number between 0 and 100";
        }
        const pass = _req.body.pass;
        if (!errors.pass && (!Number.isFinite(pass) || !Number.isInteger(pass) || pass < 0)) {
            errors.pass = "expected a number >= 0";
        }
        const fail = _req.body.fail;
        if (!errors.fail && (!Number.isFinite(fail) || !Number.isInteger(fail) || fail < 0)) {
            errors.fail = "expected a number >= 0";
        }
        const audit = _req.body.audit;
        if (!errors.audit && (!Number.isFinite(audit) || !Number.isInteger(audit) || audit < 0)) {
            errors.audit = "expected a number >= 0";
        }
        return {
            error: "Validation failed",
            fields: errors,
        };
    }
    function buildingToResponse422(_req) {
        const errors = {};
        const requiredFields = {
            name: "string",
            address: "string",
            lat: "number",
            lon: "number",
        };
        for (const [field, expectedType] of Object.entries(requiredFields)) {
            const value = _req.body[field];
            if (value === undefined) {
                errors[field] = "required but missing";
            }
            else if (expectedType === "string" && typeof value !== "string") {
                errors[field] = "expected a string";
            }
            else if (expectedType === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
                errors[field] = "expected a number";
            }
        }
        return {
            error: "Validation failed",
            fields: errors,
        };
    }
    function roomToResponse422(_req) {
        const errors = {};
        const requiredFields = ["building", "number", "type", "furniture", "href", "seats"];
        for (const field of requiredFields) {
            const value = _req.body[field];
            if (value === undefined || value === null) {
                errors[field] = "required but missing";
            }
        }
        const building = _req.body.building;
        if (!errors.building) {
            if (typeof building !== "string") {
                errors.building = "expected a string";
            }
            else if (building !== _req.params.building) {
                errors.building = "must match parent building in path";
            }
        }
        for (const field of ["number", "type", "furniture", "href"]) {
            const value = _req.body[field];
            if (!errors[field] && typeof value !== "string") {
                errors[field] = "expected a string";
            }
        }
        const seats = _req.body.seats;
        if (!errors.seats &&
            (typeof seats !== "number" || !Number.isFinite(seats) || !Number.isInteger(seats) || seats < 0)) {
            errors.seats = "expected a number >= 0";
        }
        return {
            error: "Validation failed",
            fields: errors,
        };
    }
    function datasetNotFoundBody(datasetId) {
        return { error: "Not found", message: `no dataset with id '${datasetId}'` };
    }
    app.get("/api", (_req, res) => {
        res.send("App is running!");
    });
    async function handleDatasetUpload(_req, res, options) {
        const fields = {};
        const kind = _req.body?.kind;
        if (kind === undefined || kind === null) {
            fields.kind = "required but missing";
        }
        else if (typeof kind !== "string" || !options.allowedKinds.includes(kind)) {
            fields.kind = options.invalidKindMessage;
        }
        if (!_req.file) {
            fields.archive = "required but missing";
        }
        else if (!_req.file.buffer || _req.file.buffer.length === 0) {
            fields.archive = "expected non-empty file";
        }
        if (Object.keys(fields).length > 0) {
            res.status(422).json({ error: "Validation failed", fields });
            return;
        }
        const uploadId = genUploadId();
        const job = {
            id: uploadId,
            status: "processing",
            kind: kind,
            stats: emptyStats(kind),
            message: "Dataset accepted for processing",
        };
        await setJob(datadir, job);
        res.status(202).json({
            id: uploadId,
            status: "processing",
            kind: kind,
            message: "Dataset accepted for processing",
        });
        const zipBuffer = _req.file.buffer;
        setTimeout(() => {
            void processDataset(uploadId, zipBuffer);
        }, 0);
    }
    app.post("/api/v1/datasets", upload.single("archive"), async (_req, res) => {
        await handleDatasetUpload(_req, res, {
            allowedKinds: ["course_offerings"],
            invalidKindMessage: "expected to be course_offerings",
        });
    });
    app.post("/api/v2/datasets", upload.single("archive"), async (_req, res) => {
        await handleDatasetUpload(_req, res, {
            allowedKinds: ["course_offerings", "facilities"],
            invalidKindMessage: "expected to be course_offerings or facilities",
        });
    });
    app.put("/api/v2/buildings/:building", async (_req, res) => {
        const buildingId = _req.params.building;
        const error422 = buildingToResponse422(_req);
        if (Object.keys(error422.fields).length > 0) {
            res.status(422).json(error422);
            return;
        }
        const database = await (0, databaseStore_1.readDB)();
        const existingBuilding = database.buildings[buildingId];
        const nextBuilding = {
            name: _req.body.name,
            address: _req.body.address,
            lat: _req.body.lat,
            lon: _req.body.lon,
        };
        if (existingBuilding) {
            database.buildings[buildingId] = {
                ...nextBuilding,
                rooms: existingBuilding.rooms,
            };
            await (0, databaseStore_1.writeDB)(database);
            res.sendStatus(204);
            return;
        }
        database.buildings[buildingId] = {
            ...nextBuilding,
            rooms: {},
        };
        await (0, databaseStore_1.writeDB)(database);
        res.status(201).json(buildingToResponseGETandPUT(buildingId, database.buildings[buildingId]));
    });
    async function handleDatasetStatus(_req, res) {
        const datasetId = _req.params.id;
        const job = (await readJobs(datadir))[datasetId];
        if (!job) {
            res.status(404).json(datasetNotFoundBody(datasetId));
            return;
        }
        if (job.status === "processing") {
            res.status(200).json({
                id: job.id,
                status: "processing",
                kind: job.kind,
                stats: emptyStats(job.kind),
                message: "Processing in progress",
            });
            return;
        }
        res.status(200).json({
            id: job.id,
            status: job.status,
            kind: job.kind,
            stats: job.stats,
            message: job.message,
        });
    }
    app.get("/api/v1/datasets/:id", async (_req, res) => {
        await handleDatasetStatus(_req, res);
    });
    app.get("/api/v2/datasets/:id", async (_req, res) => {
        await handleDatasetStatus(_req, res);
    });
    app.post("/api/v1/search", async (_req, res) => {
        const kind = _req.body?.kind;
        const query = _req.body?.query;
        const fields = {};
        if (kind === undefined || kind === null) {
            fields.kind = "required but missing";
        }
        else if (kind !== "course_offerings") {
            fields.kind = "expected to be course_offerings";
        }
        if (query === undefined || query === null) {
            fields.query = "required but missing";
        }
        else if (typeof query !== "object" || Array.isArray(query)) {
            fields.query = "expected an object";
        }
        if (Object.keys(fields).length > 0) {
            res.status(422).json({ error: "Validation failed", fields });
            return;
        }
        const allowedMFields = new Set(["avg", "pass", "fail", "audit", "year"]);
        const allowedSFields = new Set(["title", "dept", "code", "instructor"]);
        const allowedKeys = new Set([...allowedMFields, ...allowedSFields]);
        const invalidQuery = (message) => {
            res.status(400).json({ error: "Invalid query", message });
        };
        const validateIsPattern = (s) => {
            if (!s.includes("*")) {
                return true;
            }
            if (s.slice(1, -1).includes("*")) {
                return false;
            }
            return s.startsWith("*") || s.endsWith("*");
        };
        const matchIs = (value, pattern) => {
            if (!pattern.includes("*")) {
                return value === pattern;
            }
            const starts = pattern.startsWith("*");
            const ends = pattern.endsWith("*");
            const core = pattern.replace(/^\*/, "").replace(/\*$/, "");
            if (starts && ends) {
                return value.includes(core);
            }
            if (starts) {
                return value.endsWith(core);
            }
            return value.startsWith(core);
        };
        const validateFilter = (filter) => {
            if (typeof filter !== "object" || filter === null || Array.isArray(filter)) {
                return "WHERE must be an object with at most one FILTER";
            }
            const keys = Object.keys(filter);
            if (keys.length !== 1) {
                return "WHERE must be an object with at most one FILTER";
            }
            const op = keys[0];
            const val = filter[op];
            if (op === "AND" || op === "OR") {
                if (!Array.isArray(val) || val.length === 0) {
                    return `${op} must be a non-empty array of FILTER objects`;
                }
                for (const child of val) {
                    if (typeof child !== "object" || child === null || Array.isArray(child)) {
                        return `${op} must be a non-empty array of FILTER objects`;
                    }
                    const err = validateFilter(child);
                    if (err) {
                        return err;
                    }
                }
                return null;
            }
            if (op === "NOT") {
                if (typeof val !== "object" || val === null || Array.isArray(val)) {
                    return "NOT must be a FILTER object";
                }
                return validateFilter(val);
            }
            if (op === "GT" || op === "LT" || op === "EQ") {
                if (typeof val !== "object" || val === null || Array.isArray(val)) {
                    return `${op} must be an object with one mfield of type number`;
                }
                const ks = Object.keys(val);
                if (ks.length !== 1) {
                    return `${op} must be an object with one mfield of type number`;
                }
                const k = ks[0];
                if (!allowedMFields.has(k) || typeof val[k] !== "number") {
                    return `${op} must be an object with one mfield of type number`;
                }
                return null;
            }
            if (op === "IS") {
                if (typeof val !== "object" || val === null || Array.isArray(val)) {
                    return "IS must be an object with one sfield of type string";
                }
                const ks = Object.keys(val);
                if (ks.length !== 1) {
                    return "IS must be an object with one sfield of type string";
                }
                const k = ks[0];
                if (!allowedSFields.has(k) || typeof val[k] !== "string") {
                    return "IS must be an object with one sfield of type string";
                }
                if (!validateIsPattern(val[k])) {
                    return "IS asterisks can only be first or last character";
                }
                return null;
            }
            return "WHERE must be an object with at most one FILTER";
        };
        const evalFilter = (filter, rec) => {
            if (typeof filter !== "object" || filter === null) {
                return false;
            }
            const keys = Object.keys(filter);
            if (keys.length !== 1) {
                return false;
            }
            const op = keys[0];
            const val = filter[op];
            if (op === "IS") {
                if (typeof val !== "object" || val === null) {
                    return false;
                }
                const ks = Object.keys(val);
                if (ks.length !== 1) {
                    return false;
                }
                const k = ks[0];
                if (!allowedSFields.has(k)) {
                    return false;
                }
                if (typeof val[k] !== "string") {
                    return false;
                }
                return matchIs(`${rec[k]}`, val[k]);
            }
            if (op === "GT" || op === "LT" || op === "EQ") {
                if (typeof val !== "object" || val === null) {
                    return false;
                }
                const ks = Object.keys(val);
                if (ks.length !== 1) {
                    return false;
                }
                const k = ks[0];
                if (!allowedMFields.has(k)) {
                    return false;
                }
                if (typeof val[k] !== "number") {
                    return false;
                }
                const left = Number(rec[k]);
                const right = val[k];
                if (op === "GT")
                    return left > right;
                if (op === "LT")
                    return left < right;
                return left === right;
            }
            if (op === "NOT") {
                return !evalFilter(val, rec);
            }
            if (op === "AND") {
                if (!Array.isArray(val) || val.length === 0) {
                    return false;
                }
                return val.every((f) => evalFilter(f, rec));
            }
            if (op === "OR") {
                if (!Array.isArray(val) || val.length === 0) {
                    return false;
                }
                return val.some((f) => evalFilter(f, rec));
            }
            return false;
        };
        if (!("WHERE" in query)) {
            invalidQuery("Missing WHERE");
            return;
        }
        if (!("OPTIONS" in query)) {
            invalidQuery("Missing OPTIONS");
            return;
        }
        const where = query.WHERE;
        const options = query.OPTIONS;
        if (typeof where !== "object" || where === null || Array.isArray(where) || Object.keys(where).length > 1) {
            invalidQuery("WHERE must be an object with at most one FILTER");
            return;
        }
        if (typeof options !== "object" || options === null || Array.isArray(options)) {
            invalidQuery("OPTIONS must be an object with COLUMNS and optional ORDER");
            return;
        }
        if (!("COLUMNS" in options)) {
            invalidQuery("Missing COLUMNS");
            return;
        }
        const columns = options.COLUMNS;
        if (!Array.isArray(columns) || columns.length === 0) {
            invalidQuery("Missing COLUMNS");
            return;
        }
        for (const c of columns) {
            if (typeof c !== "string" || !allowedKeys.has(c)) {
                invalidQuery("Unknown key in COLUMNS");
                return;
            }
        }
        if ("ORDER" in options) {
            if (typeof options.ORDER !== "string" || !columns.includes(options.ORDER)) {
                invalidQuery("ORDER must be a key in COLUMNS");
                return;
            }
        }
        if (Object.keys(where).length === 1) {
            const filterErr = validateFilter(where);
            if (filterErr !== null) {
                invalidQuery(filterErr);
                return;
            }
        }
        if (Object.keys(where).length === 1 && Object.keys(where)[0] === "IS") {
            const inner = where.IS;
            if (typeof inner !== "object" || inner === null) {
                invalidQuery("IS must be an object with one sfield of type string");
                return;
            }
            const ks = Object.keys(inner);
            if (ks.length !== 1) {
                invalidQuery("IS must be an object with one sfield of type string");
                return;
            }
            const k = ks[0];
            if (!allowedSFields.has(k) || typeof inner[k] !== "string") {
                invalidQuery("IS must be an object with one sfield of type string");
                return;
            }
            if (!validateIsPattern(inner[k])) {
                invalidQuery("IS asterisks can only be first or last character");
                return;
            }
        }
        const database = await (0, databaseStore_1.readDB)();
        const allOfferings = [];
        for (const courseId of Object.keys(database.courses)) {
            const course = database.courses[courseId];
            for (const sectionId of Object.keys(course.sections)) {
                const section = course.sections[sectionId];
                allOfferings.push({
                    title: course.title,
                    dept: course.dept,
                    code: course.code,
                    instructor: section.instructor,
                    year: section.year,
                    avg: section.avg,
                    pass: section.pass,
                    fail: section.fail,
                    audit: section.audit,
                });
            }
        }
        let filtered = allOfferings;
        if (Object.keys(where).length === 1) {
            const op = Object.keys(where)[0];
            const wrapper = { [op]: where[op] };
            filtered = allOfferings.filter((r) => evalFilter(wrapper, r));
        }
        if (filtered.length > 5000) {
            res.status(413).json({
                error: "Too many results",
                message: "Query would return more than 5000 results",
                limit: 5000,
            });
            return;
        }
        if ("ORDER" in options) {
            const orderKey = options.ORDER;
            filtered = [...filtered].sort((a, b) => {
                const av = a[orderKey];
                const bv = b[orderKey];
                if (typeof av === "number" && typeof bv === "number") {
                    return av - bv;
                }
                return `${av}`.localeCompare(`${bv}`);
            });
        }
        const out = filtered.map((row) => {
            const projected = {};
            for (const c of columns) {
                projected[c] = row[c];
            }
            return projected;
        });
        res.status(200).json(out);
    });
    app.post("/api/v2/search", async (_req, res) => {
        const kind = _req.body?.kind;
        const query = _req.body?.query;
        const fields = {};
        if (kind === undefined || kind === null) {
            fields.kind = "required but missing";
        }
        else if (kind !== "course_offerings" && kind !== "facilities") {
            fields.kind = "expected to be course_offerings or facilities";
        }
        if (query === undefined || query === null) {
            fields.query = "required but missing";
        }
        else if (typeof query !== "object" || Array.isArray(query)) {
            fields.query = "expected an object";
        }
        if (Object.keys(fields).length > 0) {
            res.status(422).json({ error: "Validation failed", fields });
            return;
        }
        const COURSE_M = new Set(["avg", "pass", "fail", "audit", "year"]);
        const COURSE_S = new Set(["title", "dept", "code", "instructor"]);
        const FACILITIES_M = new Set(["lat", "lon", "seats"]);
        const FACILITIES_S = new Set(["address", "building", "furniture", "href", "name", "number", "type"]);
        const GLOBAL_M = new Set([...COURSE_M, ...FACILITIES_M]);
        const GLOBAL_S = new Set([...COURSE_S, ...FACILITIES_S]);
        const GLOBAL_KEYS = new Set([...GLOBAL_M, ...GLOBAL_S]);
        const invalidQuery = (message) => {
            res.status(400).json({ error: "Invalid query", message });
        };
        const fieldKindOf = (key) => {
            if (COURSE_M.has(key) || COURSE_S.has(key)) {
                return "course_offerings";
            }
            if (FACILITIES_M.has(key) || FACILITIES_S.has(key)) {
                return "facilities";
            }
            return null;
        };
        const isApplyKeySyntax = (value) => {
            return typeof value === "string" && value.length > 0 && !value.includes("_");
        };
        const validateIsPattern = (value) => {
            if (!value.includes("*")) {
                return true;
            }
            return !value.slice(1, -1).includes("*");
        };
        const matchIs = (value, pattern) => {
            if (!pattern.includes("*")) {
                return value === pattern;
            }
            const startsWithStar = pattern.startsWith("*");
            const endsWithStar = pattern.endsWith("*");
            const core = pattern.replace(/^\*/, "").replace(/\*$/, "");
            if (startsWithStar && endsWithStar) {
                return value.includes(core);
            }
            if (startsWithStar) {
                return value.endsWith(core);
            }
            return value.startsWith(core);
        };
        const validateFilter = (filter) => {
            if (typeof filter !== "object" || filter === null || Array.isArray(filter)) {
                return "WHERE must be an object with at most one FILTER";
            }
            const keys = Object.keys(filter);
            if (keys.length !== 1) {
                return "WHERE must be an object with at most one FILTER";
            }
            const op = keys[0];
            const val = filter[op];
            if (op === "AND" || op === "OR") {
                if (!Array.isArray(val) || val.length === 0) {
                    return `${op} must be a non-empty array of FILTER objects`;
                }
                for (const child of val) {
                    if (typeof child !== "object" || child === null || Array.isArray(child)) {
                        return `${op} must be a non-empty array of FILTER objects`;
                    }
                    if (Object.keys(child).length !== 1) {
                        return `${op} must be a non-empty array of FILTER objects`;
                    }
                    const childErr = validateFilter(child);
                    if (childErr !== null) {
                        if (childErr === "WHERE must be an object with at most one FILTER") {
                            return `${op} must be a non-empty array of FILTER objects`;
                        }
                        return childErr;
                    }
                }
                return null;
            }
            if (op === "NOT") {
                if (typeof val !== "object" || val === null || Array.isArray(val) || Object.keys(val).length !== 1) {
                    return "NOT must be a FILTER object";
                }
                const childErr = validateFilter(val);
                if (childErr !== null) {
                    if (childErr === "WHERE must be an object with at most one FILTER") {
                        return "NOT must be a FILTER object";
                    }
                    return childErr;
                }
                return null;
            }
            if (op === "LT" || op === "GT" || op === "EQ") {
                if (typeof val !== "object" || val === null || Array.isArray(val)) {
                    return `${op} must be an object with one mfield of type number`;
                }
                const innerKeys = Object.keys(val);
                if (innerKeys.length !== 1) {
                    return `${op} must be an object with one mfield of type number`;
                }
                const field = innerKeys[0];
                if (!GLOBAL_M.has(field) || typeof val[field] !== "number") {
                    return `${op} must be an object with one mfield of type number`;
                }
                return null;
            }
            if (op === "IS") {
                if (typeof val !== "object" || val === null || Array.isArray(val)) {
                    return "IS must be an object with one sfield of type string";
                }
                const innerKeys = Object.keys(val);
                if (innerKeys.length !== 1) {
                    return "IS must be an object with one sfield of type string";
                }
                const field = innerKeys[0];
                if (!GLOBAL_S.has(field) || typeof val[field] !== "string") {
                    return "IS must be an object with one sfield of type string";
                }
                if (!validateIsPattern(val[field])) {
                    return "IS asterisks can only be first or last character";
                }
                return null;
            }
            return "WHERE must be an object with at most one FILTER";
        };
        const addKindsFromFilter = (filter, seen) => {
            if (typeof filter !== "object" || filter === null || Array.isArray(filter)) {
                return;
            }
            const keys = Object.keys(filter);
            if (keys.length !== 1) {
                return;
            }
            const op = keys[0];
            const val = filter[op];
            if (op === "AND" || op === "OR") {
                if (Array.isArray(val)) {
                    for (const child of val) {
                        addKindsFromFilter(child, seen);
                    }
                }
                return;
            }
            if (op === "NOT") {
                addKindsFromFilter(val, seen);
                return;
            }
            if (op === "LT" || op === "GT" || op === "EQ" || op === "IS") {
                if (typeof val === "object" && val !== null && !Array.isArray(val)) {
                    const innerKeys = Object.keys(val);
                    if (innerKeys.length === 1) {
                        const fk = fieldKindOf(innerKeys[0]);
                        if (fk !== null) {
                            seen.add(fk);
                        }
                    }
                }
            }
        };
        const evalFilter = (filter, row) => {
            const op = Object.keys(filter)[0];
            const val = filter[op];
            if (op === "AND") {
                return val.every((child) => evalFilter(child, row));
            }
            if (op === "OR") {
                return val.some((child) => evalFilter(child, row));
            }
            if (op === "NOT") {
                return !evalFilter(val, row);
            }
            if (op === "LT" || op === "GT" || op === "EQ") {
                const field = Object.keys(val)[0];
                const left = Number(row[field]);
                const right = val[field];
                if (op === "LT")
                    return left < right;
                if (op === "GT")
                    return left > right;
                return left === right;
            }
            if (op === "IS") {
                const field = Object.keys(val)[0];
                return matchIs(String(row[field]), val[field]);
            }
            return false;
        };
        if (!("WHERE" in query)) {
            invalidQuery("Missing WHERE");
            return;
        }
        if (!("OPTIONS" in query)) {
            invalidQuery("Missing OPTIONS");
            return;
        }
        const where = query.WHERE;
        const options = query.OPTIONS;
        const hasTransformations = Object.prototype.hasOwnProperty.call(query, "TRANSFORMATIONS");
        const transformations = hasTransformations ? query.TRANSFORMATIONS : undefined;
        const queryKeys = Object.keys(query);
        if (queryKeys.some((key) => key !== "WHERE" && key !== "OPTIONS" && key !== "TRANSFORMATIONS")) {
            invalidQuery("Missing WHERE");
            return;
        }
        if (typeof where !== "object" || where === null || Array.isArray(where) || Object.keys(where).length > 1) {
            invalidQuery("WHERE must be an object with at most one FILTER");
            return;
        }
        if (typeof options !== "object" || options === null || Array.isArray(options)) {
            invalidQuery("OPTIONS must be an object with COLUMNS and optional ORDER");
            return;
        }
        const optionKeys = Object.keys(options);
        if (optionKeys.some((key) => key !== "COLUMNS" && key !== "ORDER")) {
            invalidQuery("OPTIONS must be an object with COLUMNS and optional ORDER");
            return;
        }
        if (!("COLUMNS" in options)) {
            invalidQuery("Missing COLUMNS");
            return;
        }
        const columns = options.COLUMNS;
        if (!Array.isArray(columns) || columns.length === 0) {
            invalidQuery("Missing COLUMNS");
            return;
        }
        if (Object.keys(where).length === 1) {
            const filterErr = validateFilter(where);
            if (filterErr !== null) {
                invalidQuery(filterErr);
                return;
            }
        }
        let groupKeys = [];
        const groupKeySet = new Set();
        const applyKeySet = new Set();
        const applyRules = [];
        if (hasTransformations) {
            if (typeof transformations !== "object" || transformations === null || Array.isArray(transformations)) {
                invalidQuery("Missing GROUP in TRANSFORMATIONS");
                return;
            }
            const transformationKeys = Object.keys(transformations);
            if (transformationKeys.some((key) => key !== "GROUP" && key !== "APPLY")) {
                invalidQuery("Missing GROUP in TRANSFORMATIONS");
                return;
            }
            if (!("GROUP" in transformations)) {
                invalidQuery("Missing GROUP in TRANSFORMATIONS");
                return;
            }
            if (!("APPLY" in transformations)) {
                invalidQuery("Missing APPLY in TRANSFORMATIONS");
                return;
            }
            if (!Array.isArray(transformations.GROUP) || transformations.GROUP.length === 0) {
                invalidQuery("GROUP must be a non-empty array");
                return;
            }
            if (!Array.isArray(transformations.APPLY)) {
                invalidQuery("APPLY must be an array");
                return;
            }
            for (const key of transformations.GROUP) {
                if (typeof key !== "string" || !GLOBAL_KEYS.has(key)) {
                    invalidQuery("APPLYRULE must apply aggregation to a valid KEY");
                    return;
                }
                groupKeys.push(key);
                groupKeySet.add(key);
            }
            for (const rule of transformations.APPLY) {
                if (typeof rule !== "object" || rule === null || Array.isArray(rule) || Object.keys(rule).length !== 1) {
                    invalidQuery("APPLYRULE must apply aggregation to a valid KEY");
                    return;
                }
                const applyKey = Object.keys(rule)[0];
                if (!isApplyKeySyntax(applyKey)) {
                    invalidQuery("applykey cannot be empty or contain underscore");
                    return;
                }
                if (applyKeySet.has(applyKey)) {
                    invalidQuery("Duplicate applykey in APPLY");
                    return;
                }
                const body = rule[applyKey];
                if (typeof body !== "object" || body === null || Array.isArray(body) || Object.keys(body).length !== 1) {
                    invalidQuery("APPLYRULE must apply aggregation to a valid KEY");
                    return;
                }
                const token = Object.keys(body)[0];
                const key = body[token];
                if (token !== "MAX" && token !== "MIN" && token !== "AVG" && token !== "COUNT" && token !== "SUM") {
                    invalidQuery("Invalid APPLYTOKEN (must be MAX, MIN, AVG, COUNT, or SUM)");
                    return;
                }
                if (typeof key !== "string" || !GLOBAL_KEYS.has(key)) {
                    invalidQuery("APPLYRULE must apply aggregation to a valid KEY");
                    return;
                }
                if ((token === "MAX" || token === "MIN" || token === "AVG" || token === "SUM") && !GLOBAL_M.has(key)) {
                    invalidQuery("MAX/MIN/AVG/SUM can only be applied to mfields");
                    return;
                }
                applyKeySet.add(applyKey);
                applyRules.push({ applyKey, token, key });
            }
        }
        const rawColumnsOutsideGroupOrApply = [];
        for (const column of columns) {
            if (typeof column !== "string") {
                invalidQuery("Unknown key in COLUMNS");
                return;
            }
            const fk = fieldKindOf(column);
            if (!hasTransformations) {
                if (fk === null) {
                    invalidQuery("Unknown key in COLUMNS");
                    return;
                }
                if (fk !== kind) {
                    invalidQuery("Cannot mix course_offerings and facilities fields in one query");
                    return;
                }
                continue;
            }
            if (groupKeySet.has(column) || applyKeySet.has(column)) {
                continue;
            }
            if (fk !== null) {
                if (fk !== kind) {
                    invalidQuery("Cannot mix course_offerings and facilities fields in one query");
                    return;
                }
                rawColumnsOutsideGroupOrApply.push(column);
                continue;
            }
            if (isApplyKeySyntax(column)) {
                rawColumnsOutsideGroupOrApply.push(column);
                continue;
            }
            invalidQuery("Unknown key in COLUMNS");
            return;
        }
        if ("ORDER" in options) {
            const order = options.ORDER;
            if (typeof order === "string") {
                if (!columns.includes(order)) {
                    invalidQuery("ORDER must be a key in COLUMNS");
                    return;
                }
            }
            else if (typeof order === "object" && order !== null && !Array.isArray(order)) {
                const dir = order.dir;
                const keys = order.keys;
                const orderKeys = Object.keys(order);
                if (orderKeys.some((key) => key !== "dir" && key !== "keys")) {
                    invalidQuery("All ORDER keys must be in COLUMNS");
                    return;
                }
                if (dir !== "UP" && dir !== "DOWN") {
                    invalidQuery("Invalid sort direction (must be UP or DOWN)");
                    return;
                }
                if (!Array.isArray(keys) || keys.length === 0 || keys.some((key) => typeof key !== "string")) {
                    invalidQuery("All ORDER keys must be in COLUMNS");
                    return;
                }
                for (const key of keys) {
                    if (!columns.includes(key)) {
                        invalidQuery("All ORDER keys must be in COLUMNS");
                        return;
                    }
                }
            }
            else {
                invalidQuery("ORDER must be a key in COLUMNS");
                return;
            }
        }
        const referencedKinds = new Set();
        addKindsFromFilter(where, referencedKinds);
        for (const key of groupKeys) {
            const fk = fieldKindOf(key);
            if (fk !== null) {
                referencedKinds.add(fk);
            }
        }
        for (const rule of applyRules) {
            const fk = fieldKindOf(rule.key);
            if (fk !== null) {
                referencedKinds.add(fk);
            }
        }
        if (referencedKinds.size > 1 || (referencedKinds.size === 1 && !referencedKinds.has(kind))) {
            invalidQuery("Cannot mix course_offerings and facilities fields in one query");
            return;
        }
        if (hasTransformations) {
            for (const key of groupKeys) {
                if (!columns.includes(key)) {
                    invalidQuery("When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY");
                    return;
                }
            }
        }
        if (hasTransformations && rawColumnsOutsideGroupOrApply.length > 0) {
            invalidQuery("When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY");
            return;
        }
        const database = await (0, databaseStore_1.readDB)();
        let rows = [];
        if (kind === "course_offerings") {
            for (const course of Object.values(database.courses)) {
                for (const section of Object.values(course.sections)) {
                    rows.push({
                        title: course.title,
                        dept: course.dept,
                        code: course.code,
                        instructor: section.instructor,
                        year: section.year,
                        avg: section.avg,
                        pass: section.pass,
                        fail: section.fail,
                        audit: section.audit,
                    });
                }
            }
        }
        else {
            for (const [buildingId, building] of Object.entries(database.buildings)) {
                for (const room of Object.values(building.rooms)) {
                    rows.push({
                        address: building.address,
                        building: buildingId,
                        furniture: room.furniture,
                        href: room.href,
                        name: building.name,
                        number: room.number,
                        type: room.type,
                        lat: building.lat,
                        lon: building.lon,
                        seats: room.seats,
                    });
                }
            }
        }
        if (Object.keys(where).length === 1) {
            rows = rows.filter((row) => evalFilter(where, row));
        }
        if (hasTransformations) {
            const groups = new Map();
            for (const row of rows) {
                const groupId = JSON.stringify(groupKeys.map((key) => row[key]));
                if (!groups.has(groupId)) {
                    groups.set(groupId, []);
                }
                groups.get(groupId).push(row);
            }
            rows = Array.from(groups.values()).map((groupRows) => {
                const out = {};
                for (const key of groupKeys) {
                    out[key] = groupRows[0][key];
                }
                for (const rule of applyRules) {
                    const values = groupRows.map((row) => row[rule.key]);
                    if (rule.token === "MAX") {
                        out[rule.applyKey] = Math.max(...values);
                    }
                    else if (rule.token === "MIN") {
                        out[rule.applyKey] = Math.min(...values);
                    }
                    else if (rule.token === "SUM") {
                        let total = new decimal_js_1.default(0);
                        for (const value of values) {
                            total = total.add(new decimal_js_1.default(value));
                        }
                        const sum = total.toNumber();
                        out[rule.applyKey] = Number(sum.toFixed(2));
                    }
                    else if (rule.token === "AVG") {
                        let total = new decimal_js_1.default(0);
                        for (const value of values) {
                            total = total.add(new decimal_js_1.default(value));
                        }
                        const avg = total.toNumber() / values.length;
                        out[rule.applyKey] = Number(avg.toFixed(2));
                    }
                    else {
                        out[rule.applyKey] = new Set(values).size;
                    }
                }
                return out;
            });
        }
        if (rows.length > 5000) {
            res.status(413).json({
                error: "Too many results",
                message: "Query would return more than 5000 results",
                limit: 5000,
            });
            return;
        }
        if ("ORDER" in options) {
            const order = options.ORDER;
            const orderKeys = typeof order === "string" ? [order] : order.keys;
            const direction = typeof order === "string" ? "UP" : order.dir;
            rows = [...rows].sort((a, b) => {
                for (const key of orderKeys) {
                    const av = a[key];
                    const bv = b[key];
                    if (av < bv) {
                        return direction === "DOWN" ? 1 : -1;
                    }
                    if (av > bv) {
                        return direction === "DOWN" ? -1 : 1;
                    }
                }
                return 0;
            });
        }
        const out = rows.map((row) => {
            const projected = {};
            for (const column of columns) {
                projected[column] = row[column];
            }
            return projected;
        });
        res.status(200).json(out);
    });
    app.get("/api/v2/buildings", async (_req, res) => {
        const pagination = parsePagination(_req);
        if (!pagination.ok) {
            res.status(400).json(pagination.body);
            return;
        }
        const { limit, offset } = pagination;
        const database = await (0, databaseStore_1.readDB)();
        const buildingIds = Object.keys(database.buildings).sort();
        const allItems = buildingIds.map((buildingId) => buildingToResponseGETandPUT(buildingId, database.buildings[buildingId]));
        const items = allItems.slice(offset, offset + limit);
        res.status(200).json({
            total: allItems.length,
            limit,
            offset,
            items,
        });
    });
    app.get("/api/v2/buildings/:building", async (_req, res) => {
        const buildingId = _req.params.building;
        const database = await (0, databaseStore_1.readDB)();
        const building = database.buildings[buildingId];
        if (!building) {
            res.status(404).json({ error: "Not found", message: `no building with id '${buildingId}'` });
            return;
        }
        res.status(200).json(buildingToResponseGETandPUT(buildingId, building));
    });
    app.delete("/api/v2/buildings/:building", async (_req, res) => {
        const buildingId = _req.params.building;
        const database = await (0, databaseStore_1.readDB)();
        const building = database.buildings[buildingId];
        if (!building) {
            res.status(404).json({ error: "Not found", message: `no building with id '${buildingId}'` });
            return;
        }
        const deletedBody = {
            id: buildingId,
            name: building.name,
            address: building.address,
            lat: building.lat,
            lon: building.lon,
            rooms: Object.keys(building.rooms).length,
        };
        delete database.buildings[buildingId];
        await (0, databaseStore_1.writeDB)(database);
        res.status(200).json(deletedBody);
    });
    app.put("/api/v2/buildings/:building/rooms/:room", async (_req, res) => {
        const buildingId = _req.params.building;
        const roomId = _req.params.room;
        const database = await (0, databaseStore_1.readDB)();
        const building = database.buildings[buildingId];
        if (!building) {
            res.status(404).json({ error: "Not found", message: `no building with id '${buildingId}'` });
            return;
        }
        const error422 = roomToResponse422(_req);
        if (Object.keys(error422.fields).length > 0) {
            res.status(422).json(error422);
            return;
        }
        const nextRoom = {
            number: _req.body.number,
            type: _req.body.type,
            furniture: _req.body.furniture,
            href: _req.body.href,
            seats: _req.body.seats,
        };
        const existingRoom = building.rooms[roomId];
        building.rooms[roomId] = nextRoom;
        await (0, databaseStore_1.writeDB)(database);
        if (existingRoom) {
            res.sendStatus(204);
            return;
        }
        res.status(201).json(roomToResponseGETandPUT(buildingId, roomId, nextRoom));
    });
    app.get("/api/v2/buildings/:building/rooms", async (_req, res) => {
        const pagination = parsePagination(_req);
        if (!pagination.ok) {
            res.status(400).json(pagination.body);
            return;
        }
        const buildingId = _req.params.building;
        const { limit, offset } = pagination;
        const database = await (0, databaseStore_1.readDB)();
        const building = database.buildings[buildingId];
        if (!building) {
            res.status(404).json({ error: "Not found", message: `no building with id '${buildingId}'` });
            return;
        }
        const roomIds = Object.keys(building.rooms).sort();
        const allItems = roomIds.map((roomId) => roomToResponseGETandPUT(buildingId, roomId, building.rooms[roomId]));
        const items = allItems.slice(offset, offset + limit);
        res.status(200).json({
            total: allItems.length,
            limit,
            offset,
            items,
        });
    });
    app.get("/api/v2/buildings/:building/rooms/:room", async (_req, res) => {
        const buildingId = _req.params.building;
        const roomId = _req.params.room;
        const database = await (0, databaseStore_1.readDB)();
        const building = database.buildings[buildingId];
        if (!building) {
            res.status(404).json({ error: "Not found", message: `no building with id '${buildingId}'` });
            return;
        }
        const room = building.rooms[roomId];
        if (!room) {
            res.status(404).json({ error: "Not found", message: `no room with id '${roomId}'` });
            return;
        }
        res.status(200).json(roomToResponseGETandPUT(buildingId, roomId, room));
    });
    app.delete("/api/v2/buildings/:building/rooms/:room", async (_req, res) => {
        const buildingId = _req.params.building;
        const roomId = _req.params.room;
        const database = await (0, databaseStore_1.readDB)();
        const building = database.buildings[buildingId];
        if (!building) {
            res.status(404).json({ error: "Not found", message: `no building with id '${buildingId}'` });
            return;
        }
        const room = building.rooms[roomId];
        if (!room) {
            res.status(404).json({ error: "Not found", message: `no room with id '${roomId}'` });
            return;
        }
        const deletedBody = {
            id: roomId,
            building: buildingId,
            number: room.number,
            type: room.type,
            furniture: room.furniture,
            href: room.href,
            seats: room.seats,
        };
        delete building.rooms[roomId];
        await (0, databaseStore_1.writeDB)(database);
        res.status(200).json(deletedBody);
    });
    app.use(handleErrors_1.handleErrors);
    return app;
}
//# sourceMappingURL=App.js.map