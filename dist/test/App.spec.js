"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const chai_1 = require("chai");
const supertest_1 = __importDefault(require("supertest"));
const http_status_codes_1 = require("http-status-codes");
const App_1 = require("../src/App");
const jszip_1 = __importDefault(require("jszip"));
const { OK } = http_status_codes_1.StatusCodes;
const datadir = "./data";
describe("REST API v1", function () {
    let app;
    let originalFetch;
    function setGeolocationLookup(lookup) {
        globalThis.fetch = (async (input) => {
            const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            const pathname = new URL(rawUrl).pathname;
            const address = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1));
            const payload = await lookup(address);
            return { json: async () => payload };
        });
    }
    before(() => {
        originalFetch = globalThis.fetch;
    });
    beforeEach(async () => {
        setGeolocationLookup(async () => ({ error: "not configured" }));
        app = await (0, App_1.createApp)({ datadir });
    });
    afterEach(async () => {
        globalThis.fetch = originalFetch;
        await promises_1.default.rm(datadir, { recursive: true, force: true });
    });
    function makeOffering(overrides = {}) {
        return {
            id: 21201,
            Course: "310",
            Title: "Intro to SE",
            Professor: "holmes, reid",
            Subject: "cpsc",
            Section: "001",
            Year: "2021",
            Avg: 76.4,
            Pass: 167,
            Fail: 3,
            Audit: 1,
            ...overrides,
        };
    }
    async function makeZip(entries) {
        const zip = new jszip_1.default();
        for (const entry of entries) {
            const content = typeof entry.content === "string" || Buffer.isBuffer(entry.content)
                ? entry.content
                : JSON.stringify(entry.content);
            zip.file(entry.path, content);
        }
        return zip.generateAsync({ type: "nodebuffer" });
    }
    async function postDataset(entries, kind = "course_offerings") {
        const zipBuffer = await makeZip(entries);
        return (0, supertest_1.default)(app).post("/api/v1/datasets").field("kind", kind).attach("archive", zipBuffer, "courses.zip");
    }
    async function postDatasetV2(entries, kind) {
        const zipBuffer = await makeZip(entries);
        return (0, supertest_1.default)(app).post("/api/v2/datasets").field("kind", kind).attach("archive", zipBuffer, "dataset.zip");
    }
    async function waitForDatasetTerminalStatus(uploadId) {
        let res = await (0, supertest_1.default)(app).get(`/api/v1/datasets/${uploadId}`);
        for (let i = 0; i < 80 && res.status === 200 && res.body.status === "processing"; i++) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            res = await (0, supertest_1.default)(app).get(`/api/v1/datasets/${uploadId}`);
        }
        return res;
    }
    async function uploadDatasetAndWait(entries) {
        const postRes = await postDataset(entries);
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        const uploadId = postRes.body.id;
        const statusRes = await waitForDatasetTerminalStatus(uploadId);
        return { postRes, uploadId, statusRes };
    }
    async function waitForDatasetTerminalStatusV2(uploadId) {
        let res = await (0, supertest_1.default)(app).get(`/api/v2/datasets/${uploadId}`);
        for (let i = 0; i < 80 && res.status === 200 && res.body.status === "processing"; i++) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            res = await (0, supertest_1.default)(app).get(`/api/v2/datasets/${uploadId}`);
        }
        return res;
    }
    function makeFacilitiesZip() {
        return [
            {
                path: "index.htm",
                content: `
					<html>
						<body>
							<table class="views-table">
								<tr>
									<td class="views-field-title"><a href="./dmp.htm">Hugh Dempster Pavilion</a></td>
									<td class="views-field-field-building-code">DMP</td>
									<td class="views-field-field-building-address">6245 Agronomy Road V6T 1Z4</td>
								</tr>
							</table>
						</body>
					</html>
				`,
            },
            {
                path: "dmp.htm",
                content: `
					<html>
						<body>
							<table class="views-table">
								<tr>
									<td class="views-field-field-room-number"><a>101</a></td>
									<td class="views-field-field-room-capacity">40</td>
									<td class="views-field-field-room-furniture">Classroom-Movable Tables & Chairs</td>
									<td class="views-field-field-room-type">Open Design General Purpose</td>
									<td class="views-field-nothing"><a href="http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101">Details</a></td>
								</tr>
							</table>
						</body>
					</html>
				`,
            },
        ];
    }
    function makeBuilding(overrides = {}) {
        return {
            name: "Hugh Dempster Pavilion",
            address: "6245 Agronomy Road V6T 1Z4",
            lat: 49.26125,
            lon: -123.24807,
            ...overrides,
        };
    }
    function makeRoom(overrides = {}) {
        return {
            building: "DMP",
            number: "101",
            type: "Open Design General Purpose",
            furniture: "Classroom-Movable Tables & Chairs",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
            seats: 40,
            ...overrides,
        };
    }
    async function seedOfferings(records) {
        const { statusRes } = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: records,
                },
            },
        ]);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "completed");
    }
    async function seedSearchDataset() {
        await seedOfferings([
            makeOffering({
                id: 31001,
                Course: "310",
                Subject: "cpsc",
                Title: "Intro to SE",
                Professor: "holmes, reid",
                Year: "2021",
                Avg: 76.4,
            }),
            makeOffering({
                id: 21001,
                Course: "210",
                Subject: "cpsc",
                Title: "Software Construction",
                Professor: "gregor, doug",
                Year: "2022",
                Avg: 85.0,
                Pass: 190,
            }),
            makeOffering({
                id: 20001,
                Course: "200",
                Subject: "math",
                Title: "Calculus III",
                Professor: "someone, math",
                Year: "2020",
                Avg: 90.0,
                Pass: 220,
            }),
        ]);
    }
    async function seedFacilitiesDataset() {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await (0, supertest_1.default)(app).put("/api/v2/buildings/ORCH").send({
            name: "Orchard Commons",
            address: "6363 Agronomy Road",
            lat: 49.26048,
            lon: -123.25027,
        });
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
        await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP/rooms/DMP_201")
            .send(makeRoom({
            number: "201",
            type: "Small Group",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-201",
            seats: 25,
        }));
        await (0, supertest_1.default)(app).put("/api/v2/buildings/ORCH/rooms/ORCH_300").send({
            building: "ORCH",
            number: "300",
            type: "Tiered Large Group",
            furniture: "Fixed Tables/Fixed Chairs",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ORCH-300",
            seats: 120,
        });
    }
    it("GET /api should respond with status OK and text 'App is running!'", async () => {
        const res = await (0, supertest_1.default)(app).get("/api");
        (0, chai_1.expect)(res).to.have.property("status", OK);
        (0, chai_1.expect)(res).to.have.property("text", "App is running!");
    });
    it("POST /api/v1/datasets should return 202 with a processing upload job", async () => {
        const res = await postDataset([
            {
                path: "courses/one.json",
                content: {
                    result: [makeOffering()],
                },
            },
            { path: "courses/two.json", content: "not json" },
        ]);
        (0, chai_1.expect)(res).to.have.property("status", 202);
        (0, chai_1.expect)(res).to.have.nested.property("body.id");
        (0, chai_1.expect)(res.body.id).to.be.a("string").and.not.equal("");
        (0, chai_1.expect)(res).to.have.nested.property("body.status", "processing");
        (0, chai_1.expect)(res).to.have.nested.property("body.kind", "course_offerings");
        (0, chai_1.expect)(res).to.have.nested.property("body.message", "Dataset accepted for processing");
        await waitForDatasetTerminalStatus(res.body.id);
    });
    it("POST /api/v1/datasets should return 422 when kind is missing", async () => {
        const zipBuffer = await makeZip([
            {
                path: "courses/one.json",
                content: { result: [makeOffering()] },
            },
        ]);
        const res = await (0, supertest_1.default)(app).post("/api/v1/datasets").attach("archive", zipBuffer, "courses.zip");
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: { kind: "required but missing" },
        });
    });
    it("POST /api/v1/datasets should return 422 when kind is invalid", async () => {
        const zipBuffer = await makeZip([
            {
                path: "courses/one.json",
                content: { result: [makeOffering()] },
            },
        ]);
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/datasets")
            .field("kind", "not_course_offerings")
            .attach("archive", zipBuffer, "courses.zip");
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Validation failed");
        (0, chai_1.expect)(res.body.fields).to.have.property("kind");
    });
    it("POST /api/v1/datasets should return 422 when archive is missing", async () => {
        const res = await (0, supertest_1.default)(app).post("/api/v1/datasets").field("kind", "course_offerings");
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: { archive: "required but missing" },
        });
    });
    it("POST /api/v1/datasets should return 422 when archive is empty", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/datasets")
            .field("kind", "course_offerings")
            .attach("archive", Buffer.alloc(0), "courses.zip");
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: { archive: "expected non-empty file" },
        });
    });
    it("POST /api/v1/datasets should return 422 with both errors when kind is wrong and archive is empty", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/datasets")
            .field("kind", "wrong")
            .attach("archive", Buffer.alloc(0), "courses.zip");
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Validation failed");
        (0, chai_1.expect)(res.body.fields).to.have.property("kind");
        (0, chai_1.expect)(res.body.fields).to.have.property("archive");
    });
    it("POST /api/v1/datasets should eventually fail with 'Data is not in a valid zip format' for non-zip data", async () => {
        const postRes = await (0, supertest_1.default)(app)
            .post("/api/v1/datasets")
            .field("kind", "course_offerings")
            .attach("archive", Buffer.from("not a zip"), "courses.zip");
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        (0, chai_1.expect)(postRes).to.have.nested.property("body.status", "processing");
        const res = await waitForDatasetTerminalStatus(postRes.body.id);
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.nested.property("body.status", "failed");
        (0, chai_1.expect)(res).to.have.nested.property("body.message", "Data is not in a valid zip format");
    });
    it("POST /api/v1/datasets should eventually fail with 'Missing root courses directory' when courses/ is missing", async () => {
        const postRes = await postDataset([
            {
                path: "one.json",
                content: { result: [makeOffering()] },
            },
        ]);
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        const res = await waitForDatasetTerminalStatus(postRes.body.id);
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.nested.property("body.status", "failed");
        (0, chai_1.expect)(res).to.have.nested.property("body.message", "Missing root courses directory");
    });
    it("POST /api/v1/datasets should skip valid JSON files that do not have a result property", async () => {
        const { uploadId, statusRes } = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: { result: [makeOffering()] },
            },
            {
                path: "courses/two.json",
                content: { nope: [] },
            },
        ]);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.id", uploadId);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "completed");
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.message", "Dataset processing complete");
        (0, chai_1.expect)(statusRes).to.have.deep.nested.property("body.stats", {
            files_total: 2,
            files_processed: 1,
            files_skipped: 1,
            courses_seen: 1,
            courses_added: 1,
            courses_modified: 0,
            sections_seen: 1,
            sections_added: 1,
            sections_modified: 0,
        });
    });
    it("POST /api/v1/datasets should skip invalid records in result arrays and still complete processing", async () => {
        const { statusRes } = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [
                        makeOffering({ id: 99901 }),
                        {
                            id: 99902,
                            Course: "310",
                            Title: "Intro to SE",
                            Subject: "cpsc",
                            Section: "002",
                            Year: "2021",
                            Avg: 75,
                            Pass: 10,
                            Fail: 0,
                            Audit: 0,
                        },
                        makeOffering({ id: 99903, Avg: "not-a-number" }),
                    ],
                },
            },
        ]);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "completed");
        const sectionsRes = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=0");
        (0, chai_1.expect)(sectionsRes).to.have.property("status", 200);
        (0, chai_1.expect)(sectionsRes.body).to.have.property("total", 1);
        (0, chai_1.expect)(sectionsRes.body.items).to.be.an("array").with.length(1);
        (0, chai_1.expect)(sectionsRes.body.items[0]).to.have.property("id", "99901");
        const missingInvalidRes = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections/99903");
        (0, chai_1.expect)(missingInvalidRes).to.have.property("status", 404);
    });
    it("POST /api/v1/datasets should set a course title to the most recent offering Title", async () => {
        const { statusRes } = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [
                        makeOffering({
                            id: 10001,
                            Course: "310",
                            Title: "Old Title",
                            Professor: "x",
                            Subject: "cpsc",
                            Section: "001",
                            Year: "2020",
                            Avg: 70,
                            Pass: 1,
                            Fail: 0,
                            Audit: 0,
                        }),
                        makeOffering({
                            id: 10002,
                            Course: "310",
                            Title: "New Title",
                            Professor: "y",
                            Subject: "cpsc",
                            Section: "002",
                            Year: "2021",
                            Avg: 80,
                            Pass: 2,
                            Fail: 0,
                            Audit: 0,
                        }),
                    ],
                },
            },
        ]);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "completed");
        const courseRes = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310");
        (0, chai_1.expect)(courseRes).to.have.property("status", 200);
        (0, chai_1.expect)(courseRes).to.have.nested.property("body.title", "New Title");
    });
    it("POST /api/v1/datasets should convert section year to 1900 when Section is 'overall'", async () => {
        const { statusRes } = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [
                        makeOffering({
                            id: 12345,
                            Course: "310",
                            Title: "Intro",
                            Professor: "holmes, reid",
                            Subject: "cpsc",
                            Section: "overall",
                            Year: "2019",
                            Avg: 76.4,
                            Pass: 167,
                            Fail: 3,
                            Audit: 1,
                        }),
                    ],
                },
            },
        ]);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "completed");
        const secRes = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections/12345");
        (0, chai_1.expect)(secRes).to.have.property("status", 200);
        (0, chai_1.expect)(secRes).to.have.nested.property("body.year", 1900);
    });
    it("POST /api/v1/datasets should count modified courses and sections on a later upload", async () => {
        const first = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [
                        makeOffering({
                            id: 77777,
                            Course: "310",
                            Subject: "cpsc",
                            Title: "Old Title",
                            Avg: 70,
                        }),
                    ],
                },
            },
        ]);
        (0, chai_1.expect)(first.statusRes).to.have.nested.property("body.status", "completed");
        const second = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [
                        makeOffering({
                            id: 77777,
                            Course: "310",
                            Subject: "cpsc",
                            Title: "New Title",
                            Avg: 88,
                        }),
                    ],
                },
            },
        ]);
        (0, chai_1.expect)(second.statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(second.statusRes).to.have.nested.property("body.status", "completed");
        (0, chai_1.expect)(second.statusRes).to.have.deep.nested.property("body.stats", {
            files_total: 1,
            files_processed: 1,
            files_skipped: 0,
            courses_seen: 1,
            courses_added: 0,
            courses_modified: 1,
            sections_seen: 1,
            sections_added: 0,
            sections_modified: 1,
        });
        const courseRes = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310");
        (0, chai_1.expect)(courseRes).to.have.property("status", 200);
        (0, chai_1.expect)(courseRes).to.have.nested.property("body.title", "New Title");
        const secRes = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections/77777");
        (0, chai_1.expect)(secRes).to.have.property("status", 200);
        (0, chai_1.expect)(secRes).to.have.nested.property("body.avg", 88);
    });
    it("POST /api/v1/datasets should not count unchanged resources as modified on a later upload", async () => {
        await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [makeOffering({ id: 88888, Title: "Same Title", Avg: 77 })],
                },
            },
        ]);
        const second = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [makeOffering({ id: 88888, Title: "Same Title", Avg: 77 })],
                },
            },
        ]);
        (0, chai_1.expect)(second.statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(second.statusRes).to.have.nested.property("body.status", "completed");
        (0, chai_1.expect)(second.statusRes).to.have.deep.nested.property("body.stats", {
            files_total: 1,
            files_processed: 1,
            files_skipped: 0,
            courses_seen: 1,
            courses_added: 0,
            courses_modified: 0,
            sections_seen: 1,
            sections_added: 0,
            sections_modified: 0,
        });
    });
    it("GET /api/v1/datasets/{id} should return completed upload stats after processing finishes", async () => {
        const { uploadId, statusRes } = await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [makeOffering()],
                },
            },
            { path: "courses/two.json", content: "not json" },
        ]);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.id", uploadId);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "completed");
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.kind", "course_offerings");
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.message", "Dataset processing complete");
        (0, chai_1.expect)(statusRes).to.have.deep.nested.property("body.stats", {
            files_total: 2,
            files_processed: 1,
            files_skipped: 1,
            courses_seen: 1,
            courses_added: 1,
            courses_modified: 0,
            sections_seen: 1,
            sections_added: 1,
            sections_modified: 0,
        });
    });
    it("GET /api/v1/datasets/{id} should return a valid status payload immediately after upload submission", async () => {
        const postRes = await postDataset([
            {
                path: "courses/one.json",
                content: { result: [makeOffering()] },
            },
        ]);
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        const uploadId = postRes.body.id;
        const res = await (0, supertest_1.default)(app).get(`/api/v1/datasets/${uploadId}`);
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.nested.property("body.id", uploadId);
        (0, chai_1.expect)(res).to.have.nested.property("body.kind", "course_offerings");
        if (res.body.status === "processing") {
            (0, chai_1.expect)(res).to.have.nested.property("body.message", "Processing in progress");
            (0, chai_1.expect)(res).to.have.deep.nested.property("body.stats", {
                files_total: 0,
                files_processed: 0,
                files_skipped: 0,
                courses_seen: 0,
                courses_added: 0,
                courses_modified: 0,
                sections_seen: 0,
                sections_added: 0,
                sections_modified: 0,
            });
        }
        else if (res.body.status === "completed") {
            (0, chai_1.expect)(res).to.have.nested.property("body.message", "Dataset processing complete");
        }
        else {
            chai_1.expect.fail(`Unexpected dataset status immediately after upload: ${String(res.body.status)}`);
        }
        await waitForDatasetTerminalStatus(uploadId);
    });
    it("GET /api/v1/datasets/{id} should return 404 when the dataset upload id does not exist", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/datasets/upload_does_not_exist");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Not found");
        (0, chai_1.expect)(res).to.have.nested.property("body.message");
        (0, chai_1.expect)(res.body.message).to.be.a("string").and.not.equal("");
    });
    it("POST /api/v2/datasets should accept a facilities upload and create a processing job", async () => {
        setGeolocationLookup(async (address) => {
            if (address === "6245 Agronomy Road V6T 1Z4") {
                return { lat: 49.26125, lon: -123.24807 };
            }
            return { error: "missing" };
        });
        const postRes = await postDatasetV2(makeFacilitiesZip(), "facilities");
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        (0, chai_1.expect)(postRes).to.have.nested.property("body.kind", "facilities");
        (0, chai_1.expect)(postRes).to.have.nested.property("body.status", "processing");
        const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "completed");
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.kind", "facilities");
        (0, chai_1.expect)(statusRes).to.have.deep.nested.property("body.stats", {
            buildings_added: 1,
            buildings_modified: 0,
            rooms_added: 1,
            rooms_modified: 0,
        });
    });
    it("POST /api/v2/datasets should return 422 when kind is invalid for v2", async () => {
        const zipBuffer = await makeZip(makeFacilitiesZip());
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/datasets")
            .field("kind", "wrong")
            .attach("archive", zipBuffer, "dataset.zip");
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: { kind: "expected to be course_offerings or facilities" },
        });
    });
    it("POST /api/v2/datasets should eventually fail when index.htm is missing", async () => {
        const postRes = await postDatasetV2([
            {
                path: "rooms.htm",
                content: "<html><body>no index</body></html>",
            },
        ], "facilities");
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "failed");
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.message", "Missing index.htm file");
    });
    it("POST /api/v2/datasets should accept course_offerings uploads with the v2 contract", async () => {
        const postRes = await postDatasetV2([
            {
                path: "courses/one.json",
                content: { result: [makeOffering()] },
            },
        ], "course_offerings");
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        (0, chai_1.expect)(postRes).to.have.nested.property("body.kind", "course_offerings");
        (0, chai_1.expect)(postRes).to.have.nested.property("body.status", "processing");
        (0, chai_1.expect)(postRes).to.have.nested.property("body.message", "Dataset accepted for processing");
        const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "completed");
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.kind", "course_offerings");
        (0, chai_1.expect)(statusRes).to.have.deep.nested.property("body.stats", {
            files_total: 1,
            files_processed: 1,
            files_skipped: 0,
            courses_seen: 1,
            courses_added: 1,
            courses_modified: 0,
            sections_seen: 1,
            sections_added: 1,
            sections_modified: 0,
        });
    });
    it("POST /api/v2/datasets should return both v2 validation errors when kind is invalid and archive is empty", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/datasets")
            .field("kind", "wrong")
            .attach("archive", Buffer.alloc(0), "dataset.zip");
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                kind: "expected to be course_offerings or facilities",
                archive: "expected non-empty file",
            },
        });
    });
    it("POST /api/v2/datasets should fail when index.htm has no building table", async () => {
        setGeolocationLookup(async () => ({ lat: 49.26125, lon: -123.24807 }));
        const postRes = await postDatasetV2([
            {
                path: "index.htm",
                content: "<html><body><div>no table here</div></body></html>",
            },
        ], "facilities");
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.status", "failed");
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.message", "No building table found in index.htm");
    });
    it("GET /api/v2/datasets/{id} should return facilities processing stats after completion", async () => {
        setGeolocationLookup(async () => ({ lat: 49.26125, lon: -123.24807 }));
        const postRes = await postDatasetV2(makeFacilitiesZip(), "facilities");
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id);
        (0, chai_1.expect)(statusRes).to.have.property("status", 200);
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.kind", "facilities");
        (0, chai_1.expect)(statusRes).to.have.nested.property("body.message", "Dataset processing complete");
        (0, chai_1.expect)(statusRes.body.stats).to.have.property("buildings_added", 1);
        (0, chai_1.expect)(statusRes.body.stats).to.have.property("rooms_added", 1);
    });
    it("GET /api/v2/datasets/{id} should return 404 when the dataset id does not exist", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/datasets/upload_missing");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no dataset with id 'upload_missing'",
        });
    });
    it("GET /api/v2/datasets/{id} should return processing payload with zeroed facilities stats before completion", async () => {
        setGeolocationLookup(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return { lat: 49.26125, lon: -123.24807 };
        });
        const postRes = await postDatasetV2(makeFacilitiesZip(), "facilities");
        (0, chai_1.expect)(postRes).to.have.property("status", 202);
        const res = await (0, supertest_1.default)(app).get(`/api/v2/datasets/${postRes.body.id}`);
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.nested.property("body.kind", "facilities");
        if (res.body.status === "processing") {
            (0, chai_1.expect)(res).to.have.nested.property("body.message", "Processing in progress");
            (0, chai_1.expect)(res).to.have.deep.nested.property("body.stats", {
                buildings_added: 0,
                buildings_modified: 0,
                rooms_added: 0,
                rooms_modified: 0,
            });
        }
        else {
            (0, chai_1.expect)(res).to.have.nested.property("body.status", "completed");
        }
        await waitForDatasetTerminalStatusV2(postRes.body.id);
    });
    it("PUT /api/v2/buildings/DMP should return 201 with the created building resource", async () => {
        const res = await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        (0, chai_1.expect)(res).to.have.property("status", 201);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "DMP",
            name: "Hugh Dempster Pavilion",
            address: "6245 Agronomy Road V6T 1Z4",
            lat: 49.26125,
            lon: -123.24807,
            links: {
                self: "/api/v2/buildings/DMP",
                rooms: "/api/v2/buildings/DMP/rooms",
            },
        });
    });
    it("PUT /api/v2/buildings/DMP should return 204 when updating an existing building", async () => {
        const first = await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        (0, chai_1.expect)(first).to.have.property("status", 201);
        const res = await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP")
            .send(makeBuilding({
            name: "Hugh Dempster Pavilion Updated",
            lat: 49.2,
            lon: -123.2,
        }));
        (0, chai_1.expect)(res).to.have.property("status", 204);
        (0, chai_1.expect)(res.text).to.equal("");
    });
    it("PUT /api/v2/buildings/DMP should return 422 when required fields are missing or invalid", async () => {
        const res = await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send({
            address: 123,
            lon: "west",
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                name: "required but missing",
                address: "expected a string",
                lat: "required but missing",
                lon: "expected a number",
            },
        });
    });
    it("PUT /api/v2/buildings/DMP should return 422 when numeric fields are non-finite", async () => {
        const res = await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP")
            .send(makeBuilding({
            lat: Number.NaN,
            lon: Number.POSITIVE_INFINITY,
        }));
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                lat: "expected a number",
                lon: "expected a number",
            },
        });
    });
    it("GET /api/v2/buildings should return 200 with default pagination on an empty building list", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            total: 0,
            limit: 100,
            offset: 0,
            items: [],
        });
    });
    it("GET /api/v2/buildings?limit=100&offset=0 should return 200 with an empty building list", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            total: 0,
            limit: 100,
            offset: 0,
            items: [],
        });
    });
    it("GET /api/v2/buildings should paginate using limit and offset", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/ANGU").send({
            name: "Angus Building",
            address: "2053 Main Mall",
            lat: 49.26486,
            lon: -123.25302,
        });
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await (0, supertest_1.default)(app).put("/api/v2/buildings/ORCH").send({
            name: "Orchard Commons",
            address: "6363 Agronomy Road",
            lat: 49.26048,
            lon: -123.25027,
        });
        const pageRes = await (0, supertest_1.default)(app).get("/api/v2/buildings?limit=1&offset=1");
        (0, chai_1.expect)(pageRes).to.have.property("status", 200);
        (0, chai_1.expect)(pageRes.body).to.have.property("total", 3);
        (0, chai_1.expect)(pageRes.body).to.have.property("limit", 1);
        (0, chai_1.expect)(pageRes.body).to.have.property("offset", 1);
        (0, chai_1.expect)(pageRes.body.items).to.deep.equal([
            {
                id: "DMP",
                name: "Hugh Dempster Pavilion",
                address: "6245 Agronomy Road V6T 1Z4",
                lat: 49.26125,
                lon: -123.24807,
                links: {
                    self: "/api/v2/buildings/DMP",
                    rooms: "/api/v2/buildings/DMP/rooms",
                },
            },
        ]);
        const emptyPageRes = await (0, supertest_1.default)(app).get("/api/v2/buildings?limit=10&offset=99");
        (0, chai_1.expect)(emptyPageRes).to.have.property("status", 200);
        (0, chai_1.expect)(emptyPageRes.body).to.have.property("total", 3);
        (0, chai_1.expect)(emptyPageRes.body.items).to.deep.equal([]);
    });
    it("GET /api/v2/buildings should include created building ids in paginated results", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/ORCH").send({
            name: "Orchard Commons",
            address: "6363 Agronomy Road",
            lat: 49.26048,
            lon: -123.25027,
        });
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.have.property("total", 2);
        (0, chai_1.expect)(res.body.items).to.be.an("array").with.length(2);
        (0, chai_1.expect)(res.body.items.map((item) => item.id)).to.have.members(["DMP", "ORCH"]);
    });
    it("GET /api/v2/buildings?limit=0&offset=0 should return 400 for an invalid limit", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings?limit=0&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v2/buildings?limit=100&offset=-1 should return 400 for an invalid offset", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings?limit=100&offset=-1");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v2/buildings should return 400 when both limit and offset are invalid", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings?limit=0&offset=-1");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v2/buildings should return 400 when limit is not an integer (e.g., 1.5)", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings?limit=1.5&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body.params).to.have.property("limit");
    });
    it("GET /api/v2/buildings/DMP should return 200 with the building resource", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "DMP",
            name: "Hugh Dempster Pavilion",
            address: "6245 Agronomy Road V6T 1Z4",
            lat: 49.26125,
            lon: -123.24807,
            links: {
                self: "/api/v2/buildings/DMP",
                rooms: "/api/v2/buildings/DMP/rooms",
            },
        });
    });
    it("GET /api/v2/buildings/DMP should return 404 when the building does not exist", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no building with id 'DMP'",
        });
    });
    it("DELETE /api/v2/buildings/DMP should return 200 with deleted building metadata and room count", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await promises_1.default.mkdir(`${datadir}`, { recursive: true });
        await promises_1.default.writeFile(`${datadir}/database.json`, JSON.stringify({
            courses: {},
            buildings: {
                DMP: {
                    name: "Hugh Dempster Pavilion",
                    address: "6245 Agronomy Road V6T 1Z4",
                    lat: 49.26125,
                    lon: -123.24807,
                    rooms: {
                        DMP_101: {
                            number: "101",
                            type: "Open Design General Purpose",
                            furniture: "Classroom-Movable Tables & Chairs",
                            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
                            seats: 40,
                        },
                        DMP_201: {
                            number: "201",
                            type: "Small Group",
                            furniture: "Tables and Chairs",
                            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-201",
                            seats: 12,
                        },
                    },
                },
            },
        }), "utf8");
        const res = await (0, supertest_1.default)(app).delete("/api/v2/buildings/DMP");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.include({
            id: "DMP",
            name: "Hugh Dempster Pavilion",
        });
        (0, chai_1.expect)(res.body).to.have.property("rooms");
    });
    it("DELETE /api/v2/buildings/ORCH should return 200 with zero rooms when the building has no rooms", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/ORCH").send({
            name: "Orchard Commons",
            address: "6363 Agronomy Road",
            lat: 49.26048,
            lon: -123.25027,
        });
        const res = await (0, supertest_1.default)(app).delete("/api/v2/buildings/ORCH");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "ORCH",
            name: "Orchard Commons",
            address: "6363 Agronomy Road",
            lat: 49.26048,
            lon: -123.25027,
            rooms: 0,
        });
    });
    it("DELETE /api/v2/buildings/DMP should return 404 when the building does not exist", async () => {
        const res = await (0, supertest_1.default)(app).delete("/api/v2/buildings/DMP");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no building with id 'DMP'",
        });
    });
    it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 201 with the created room resource", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
        (0, chai_1.expect)(res).to.have.property("status", 201);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "DMP_101",
            building: "DMP",
            number: "101",
            type: "Open Design General Purpose",
            furniture: "Classroom-Movable Tables & Chairs",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
            seats: 40,
            links: {
                self: "/api/v2/buildings/DMP/rooms/DMP_101",
                building: "/api/v2/buildings/DMP",
            },
        });
    });
    it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 204 when updating an existing room", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
        const res = await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP/rooms/DMP_101")
            .send(makeRoom({
            type: "Small Group",
            furniture: "Tables and Chairs",
            seats: 12,
        }));
        (0, chai_1.expect)(res).to.have.property("status", 204);
        (0, chai_1.expect)(res.text).to.equal("");
    });
    it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the building does not exist", async () => {
        const res = await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no building with id 'DMP'",
        });
    });
    it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 422 when required fields are missing or invalid", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
            building: "ORCH",
            number: 101,
            furniture: 12,
            seats: -1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Validation failed");
        (0, chai_1.expect)(res.body.fields).to.be.an("object");
        (0, chai_1.expect)(Object.keys(res.body.fields)).to.not.be.empty;
    });
    it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 422 when seats is fractional or non-finite", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const fractional = await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP/rooms/DMP_101")
            .send(makeRoom({ seats: 40.5 }));
        (0, chai_1.expect)(fractional).to.have.property("status", 422);
        (0, chai_1.expect)(fractional).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                seats: "expected a number >= 0",
            },
        });
        const nonFinite = await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP/rooms/DMP_101")
            .send(makeRoom({ seats: "many" }));
        (0, chai_1.expect)(nonFinite).to.have.property("status", 422);
        (0, chai_1.expect)(nonFinite).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                seats: "expected a number >= 0",
            },
        });
    });
    it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 422 when required fields are null", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
            building: null,
            number: null,
            type: null,
            furniture: null,
            href: null,
            seats: null,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Validation failed");
        (0, chai_1.expect)(res.body.fields).to.be.an("object");
        (0, chai_1.expect)(Object.keys(res.body.fields)).to.not.be.empty;
    });
    it("GET /api/v2/buildings/DMP/rooms?limit=100&offset=0 should return 200 with a room list", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
        await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP/rooms/DMP_201")
            .send(makeRoom({
            number: "201",
            type: "Small Group",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-201",
            seats: 25,
        }));
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            total: 2,
            limit: 100,
            offset: 0,
            items: [
                {
                    id: "DMP_101",
                    building: "DMP",
                    number: "101",
                    type: "Open Design General Purpose",
                    furniture: "Classroom-Movable Tables & Chairs",
                    href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
                    seats: 40,
                    links: {
                        self: "/api/v2/buildings/DMP/rooms/DMP_101",
                        building: "/api/v2/buildings/DMP",
                    },
                },
                {
                    id: "DMP_201",
                    building: "DMP",
                    number: "201",
                    type: "Small Group",
                    furniture: "Classroom-Movable Tables & Chairs",
                    href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-201",
                    seats: 25,
                    links: {
                        self: "/api/v2/buildings/DMP/rooms/DMP_201",
                        building: "/api/v2/buildings/DMP",
                    },
                },
            ],
        });
    });
    it("GET /api/v2/buildings/DMP/rooms?limit=0&offset=0 should return 400 for an invalid limit", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms?limit=0&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid request parameters",
            params: { limit: "expected an integer between 1 and 5000" },
        });
    });
    it("GET /api/v2/buildings/DMP/rooms?limit=5001&offset=0 should return 400 for an invalid limit", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms?limit=5001&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid request parameters",
            params: { limit: "expected an integer between 1 and 5000" },
        });
    });
    it("GET /api/v2/buildings/DMP/rooms?limit=100&offset=-1 should return 400 for an invalid offset", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms?limit=100&offset=-1");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid request parameters",
            params: { offset: "expected an integer >= 0" },
        });
    });
    it("GET /api/v2/buildings/DMP/rooms?limit=100&offset=0 should return 404 when the building does not exist", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no building with id 'DMP'",
        });
    });
    it("GET /api/v2/buildings/DMP/rooms should return 200 with default pagination", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.have.property("total", 1);
        (0, chai_1.expect)(res.body).to.have.property("limit", 100);
        (0, chai_1.expect)(res.body).to.have.property("offset", 0);
        (0, chai_1.expect)(res.body.items).to.be.an("array").with.length(1);
    });
    it("GET /api/v2/buildings/DMP/rooms?limit=100&offset=0 should include created room ids", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP/rooms/DMP_z")
            .send(makeRoom({
            number: "999",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-999",
        }));
        await (0, supertest_1.default)(app)
            .put("/api/v2/buildings/DMP/rooms/DMP_a")
            .send(makeRoom({
            number: "001",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-001",
        }));
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body.items.map((item) => item.id)).to.have.members(["DMP_a", "DMP_z"]);
    });
    it("GET /api/v2/buildings/DMP/rooms/DMP_101 should return 200 with the room resource", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "DMP_101",
            building: "DMP",
            number: "101",
            type: "Open Design General Purpose",
            furniture: "Classroom-Movable Tables & Chairs",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
            seats: 40,
            links: {
                self: "/api/v2/buildings/DMP/rooms/DMP_101",
                building: "/api/v2/buildings/DMP",
            },
        });
    });
    it("GET /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the building does not exist", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no building with id 'DMP'",
        });
    });
    it("GET /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the room does not exist", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no room with id 'DMP_101'",
        });
    });
    it("DELETE /api/v2/buildings/DMP/rooms/DMP_101 should return 200 with the deleted room", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
        const res = await (0, supertest_1.default)(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "DMP_101",
            building: "DMP",
            number: "101",
            type: "Open Design General Purpose",
            furniture: "Classroom-Movable Tables & Chairs",
            href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
            seats: 40,
        });
    });
    it("DELETE /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the building does not exist", async () => {
        const res = await (0, supertest_1.default)(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no building with id 'DMP'",
        });
    });
    it("DELETE /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the room does not exist", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/DMP").send(makeBuilding());
        const res = await (0, supertest_1.default)(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no room with id 'DMP_101'",
        });
    });
    it("POST /api/v1/search should return 200 with query results for a simple IS filter", async () => {
        await uploadDatasetAndWait([
            {
                path: "courses/one.json",
                content: {
                    result: [makeOffering()],
                },
            },
        ]);
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { IS: { dept: "cpsc" } },
                OPTIONS: { COLUMNS: ["dept", "avg"], ORDER: "avg" },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [{ dept: "cpsc", avg: 76.4 }]);
    });
    it("POST /api/v1/search should support valid wildcard forms in IS comparisons", async () => {
        await seedSearchDataset();
        const exactRes = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { IS: { dept: "cpsc" } },
                OPTIONS: { COLUMNS: ["code"], ORDER: "code" },
            },
        });
        (0, chai_1.expect)(exactRes).to.have.property("status", 200);
        (0, chai_1.expect)(exactRes).to.have.deep.property("body", [{ code: "210" }, { code: "310" }]);
        const startsWithRes = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { IS: { dept: "cp*" } },
                OPTIONS: { COLUMNS: ["code"], ORDER: "code" },
            },
        });
        (0, chai_1.expect)(startsWithRes).to.have.property("status", 200);
        (0, chai_1.expect)(startsWithRes).to.have.deep.property("body", [{ code: "210" }, { code: "310" }]);
        const endsWithRes = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { IS: { dept: "*th" } },
                OPTIONS: { COLUMNS: ["dept", "code"] },
            },
        });
        (0, chai_1.expect)(endsWithRes).to.have.property("status", 200);
        (0, chai_1.expect)(endsWithRes.body).to.deep.include({ dept: "math", code: "200" });
        const containsRes = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { IS: { dept: "*ps*" } },
                OPTIONS: { COLUMNS: ["code"], ORDER: "code" },
            },
        });
        (0, chai_1.expect)(containsRes).to.have.property("status", 200);
        (0, chai_1.expect)(containsRes).to.have.deep.property("body", [{ code: "210" }, { code: "310" }]);
    });
    it("POST /api/v1/search should support GT/LT/EQ and logical filters AND/OR/NOT", async () => {
        await seedSearchDataset();
        const andRes = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    AND: [{ IS: { dept: "cpsc" } }, { GT: { avg: 80 } }],
                },
                OPTIONS: { COLUMNS: ["code", "avg"], ORDER: "code" },
            },
        });
        (0, chai_1.expect)(andRes).to.have.property("status", 200);
        (0, chai_1.expect)(andRes).to.have.deep.property("body", [{ code: "210", avg: 85 }]);
        const orRes = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    OR: [{ EQ: { avg: 76.4 } }, { EQ: { avg: 90 } }],
                },
                OPTIONS: { COLUMNS: ["dept", "avg"], ORDER: "avg" },
            },
        });
        (0, chai_1.expect)(orRes).to.have.property("status", 200);
        (0, chai_1.expect)(orRes).to.have.deep.property("body", [
            { dept: "cpsc", avg: 76.4 },
            { dept: "math", avg: 90 },
        ]);
        const notRes = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    NOT: { IS: { dept: "cpsc" } },
                },
                OPTIONS: { COLUMNS: ["dept", "code"] },
            },
        });
        (0, chai_1.expect)(notRes).to.have.property("status", 200);
        (0, chai_1.expect)(notRes.body).to.be.an("array").with.length(1);
        (0, chai_1.expect)(notRes.body[0]).to.deep.equal({ dept: "math", code: "200" });
        const ltRes = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { LT: { avg: 80 } },
                OPTIONS: { COLUMNS: ["code"], ORDER: "code" },
            },
        });
        (0, chai_1.expect)(ltRes).to.have.property("status", 200);
        (0, chai_1.expect)(ltRes).to.have.deep.property("body", [{ code: "310" }]);
    });
    it("POST /api/v1/search should allow WHERE:{} to match all records and ORDER to be omitted", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.be.an("array").with.length(3);
        for (const row of res.body) {
            (0, chai_1.expect)(row).to.have.all.keys(["dept"]);
        }
    });
    it("POST /api/v1/search should return 200 when query matches exactly 5000 results", async () => {
        const rows = Array.from({ length: 5000 }, (_, i) => makeOffering({
            id: i + 1,
            Subject: "cpsc",
            Course: "310",
            Section: `${i}`,
        }));
        await uploadDatasetAndWait([
            {
                path: "courses/exact5000.json",
                content: { result: rows },
            },
        ]);
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.be.an("array").with.length(5000);
    });
    it("POST /api/v1/search should return 400 when query is missing WHERE", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: { OPTIONS: { COLUMNS: ["dept"] } },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Missing WHERE",
        });
    });
    it("POST /api/v1/search should return 400 when query is missing OPTIONS", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: { WHERE: {} },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Missing OPTIONS",
        });
    });
    it("POST /api/v1/search should return 400 when OPTIONS is missing COLUMNS", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: { WHERE: {}, OPTIONS: {} },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Missing COLUMNS",
        });
    });
    it("POST /api/v1/search should return 400 when ORDER is not present in COLUMNS", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept"], ORDER: "avg" },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "ORDER must be a key in COLUMNS",
        });
    });
    it("POST /api/v1/search should return 400 when COLUMNS contains an unknown key", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept", "gpa"] } },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Unknown key in COLUMNS",
        });
    });
    it("POST /api/v1/search should return 400 when WHERE is not an object", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: { WHERE: [], OPTIONS: { COLUMNS: ["dept"] } },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v1/search should return 400 when WHERE contains more than one FILTER", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { GT: { avg: 70 }, LT: { avg: 90 } },
                OPTIONS: { COLUMNS: ["avg"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v1/search should return 400 when OPTIONS is not an object", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: { WHERE: {}, OPTIONS: [] },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v1/search should return 400 when IS wildcard asterisks appear in the middle of the string", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: { WHERE: { IS: { dept: "c*sc" } }, OPTIONS: { COLUMNS: ["dept"] } },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "IS asterisks can only be first or last character",
        });
    });
    it("POST /api/v1/search should return 400 when AND is an empty array", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { AND: [] },
                OPTIONS: { COLUMNS: ["dept"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "AND must be a non-empty array of FILTER objects",
        });
    });
    it("POST /api/v1/search should return 400 when GT is malformed", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { GT: { avg: "99" } },
                OPTIONS: { COLUMNS: ["avg"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "GT must be an object with one mfield of type number",
        });
    });
    it("POST /api/v1/search should return 400 when NOT is not a FILTER object", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { NOT: [] },
                OPTIONS: { COLUMNS: ["dept"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v1/search should return 400 when IS is malformed", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { IS: { dept: 123 } },
                OPTIONS: { COLUMNS: ["dept"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "IS must be an object with one sfield of type string",
        });
    });
    it("POST /api/v1/search should return 422 when kind is missing", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v1/search")
            .send({
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: { kind: "required but missing" },
        });
    });
    it("POST /api/v1/search should return 422 when query is missing", async () => {
        const res = await (0, supertest_1.default)(app).post("/api/v1/search").send({ kind: "course_offerings" });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: { query: "required but missing" },
        });
    });
    it("POST /api/v1/search should return 422 with both kind and query errors when both are invalid", async () => {
        const res = await (0, supertest_1.default)(app).post("/api/v1/search").send({
            kind: "wrong",
            query: [],
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Validation failed");
        (0, chai_1.expect)(res.body.fields).to.be.an("object");
        (0, chai_1.expect)(Object.keys(res.body.fields)).to.not.be.empty;
    });
    it("POST /api/v2/search should return facilities query results", async () => {
        await seedFacilitiesDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "facilities",
            query: {
                WHERE: { GT: { seats: 30 } },
                OPTIONS: { COLUMNS: ["building", "number", "seats"], ORDER: "seats" },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [
            { building: "DMP", number: "101", seats: 40 },
            { building: "ORCH", number: "300", seats: 120 },
        ]);
    });
    it("POST /api/v2/search should support TRANSFORMATIONS with GROUP and APPLY", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "maxAvg"],
                    ORDER: { dir: "DOWN", keys: ["maxAvg", "dept"] },
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ maxAvg: { MAX: "avg" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [
            { dept: "math", maxAvg: 90 },
            { dept: "cpsc", maxAvg: 85 },
        ]);
    });
    it("POST /api/v2/search should support ORDER objects with direction and multiple keys", async () => {
        await seedFacilitiesDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "facilities",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["building", "number", "seats"],
                    ORDER: { dir: "DOWN", keys: ["seats", "number"] },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [
            { building: "ORCH", number: "300", seats: 120 },
            { building: "DMP", number: "101", seats: 40 },
            { building: "DMP", number: "201", seats: 25 },
        ]);
    });
    it("POST /api/v2/search should use spec aggregation semantics for AVG, SUM, and COUNT", async () => {
        await seedOfferings([
            makeOffering({
                id: 40001,
                Course: "400",
                Subject: "cpsc",
                Professor: "alpha",
                Avg: 0.005,
            }),
            makeOffering({
                id: 40002,
                Course: "410",
                Subject: "cpsc",
                Professor: "beta",
                Avg: 0.02,
            }),
            makeOffering({
                id: 40003,
                Course: "420",
                Subject: "cpsc",
                Professor: "beta",
                Avg: 0.02,
            }),
        ]);
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "avgRounded", "sumAvg", "uniqueInstructors"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [
                        { avgRounded: { AVG: "avg" } },
                        { sumAvg: { SUM: "avg" } },
                        { uniqueInstructors: { COUNT: "instructor" } },
                    ],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.be.an("array").with.length(1);
        (0, chai_1.expect)(res.body[0]).to.include({ dept: "cpsc", uniqueInstructors: 2 });
        (0, chai_1.expect)(res.body[0].avgRounded).to.be.a("number");
        (0, chai_1.expect)(res.body[0].sumAvg).to.be.a("number");
    });
    it("POST /api/v2/search should sort string ORDER keys using JavaScript relational comparisons", async () => {
        await (0, supertest_1.default)(app).put("/api/v2/buildings/SORT").send({
            name: "Sort Building",
            address: "123 Sort Street",
            lat: 49.2,
            lon: -123.1,
        });
        await (0, supertest_1.default)(app).put("/api/v2/buildings/SORT/rooms/SORT_Z1").send({
            building: "SORT",
            number: "Z1",
            type: "Lab",
            furniture: "Tables",
            href: "http://example.com/Z1",
            seats: 10,
        });
        await (0, supertest_1.default)(app).put("/api/v2/buildings/SORT/rooms/SORT_a1").send({
            building: "SORT",
            number: "a1",
            type: "Lab",
            furniture: "Tables",
            href: "http://example.com/a1",
            seats: 10,
        });
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "facilities",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["number"],
                    ORDER: "number",
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [{ number: "Z1" }, { number: "a1" }]);
    });
    it("POST /api/v2/search should return 400 when a query mixes course_offerings and facilities fields", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: { GT: { seats: 30 } },
                OPTIONS: { COLUMNS: ["dept", "seats"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v2/search should return 400 when ORDER dir is invalid", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "avg"],
                    ORDER: { dir: "SIDEWAYS", keys: ["avg"] },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Invalid sort direction (must be UP or DOWN)",
        });
    });
    it("POST /api/v2/search should return 400 when TRANSFORMATIONS is missing GROUP", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept", "maxAvg"] },
                TRANSFORMATIONS: {
                    APPLY: [{ maxAvg: { MAX: "avg" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v2/search should return 400 when TRANSFORMATIONS is missing APPLY", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Missing APPLY in TRANSFORMATIONS",
        });
    });
    it("POST /api/v2/search should return 400 when GROUP is an empty array", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept"] },
                TRANSFORMATIONS: {
                    GROUP: [],
                    APPLY: [],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v2/search should return 400 when APPLY is not an array", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: {},
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v2/search should return 400 when AVG is applied to an sfield", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept", "badAvg"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ badAvg: { AVG: "instructor" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "MAX/MIN/AVG/SUM can only be applied to mfields",
        });
    });
    it("POST /api/v2/search should return 400 when APPLY uses an invalid token", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept", "badToken"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ badToken: { MEDIAN: "avg" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Invalid APPLYTOKEN (must be MAX, MIN, AVG, COUNT, or SUM)",
        });
    });
    it("POST /api/v2/search should return 400 when APPLYRULE does not apply to a valid key", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept", "badRule"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ badRule: { MAX: "notAKey" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v2/search should return 400 when APPLY contains duplicate applykeys", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept", "dup"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ dup: { MAX: "avg" } }, { dup: { MIN: "avg" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Duplicate applykey in APPLY",
        });
    });
    it("POST /api/v2/search should return 400 when applykey contains an underscore", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept", "bad_key"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ bad_key: { MAX: "avg" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "applykey cannot be empty or contain underscore",
        });
    });
    it("POST /api/v2/search should return 400 when COLUMNS contains a key outside GROUP and APPLY", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept", "avg"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY",
        });
    });
    it("POST /api/v2/search should return 400 when COLUMNS uses a facilities key for course_offerings", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["seats"] },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Cannot mix course_offerings and facilities fields in one query",
        });
    });
    it("POST /api/v2/search should return 400 when TRANSFORMATIONS mixes course_offerings and facilities fields", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    GT: { avg: 0 },
                },
                OPTIONS: {
                    COLUMNS: ["roomCount"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["seats"],
                    APPLY: [{ roomCount: { COUNT: "seats" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Cannot mix course_offerings and facilities fields in one query",
        });
    });
    it("POST /api/v2/search should return 400 when ORDER uses a facilities key for course_offerings", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                    ORDER: { dir: "UP", keys: ["seats"] },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Invalid query");
    });
    it("POST /api/v2/search should not return 413 when more than 5000 rows collapse below the cap after grouping", async () => {
        const offerings = Array.from({ length: 5001 }, (_, index) => makeOffering({
            id: 50000 + index,
            Course: `${100 + index}`,
            Subject: "cpsc",
            Professor: `prof-${index}`,
            Avg: index % 100,
            Pass: index,
        }));
        await seedOfferings(offerings);
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: { COLUMNS: ["dept", "countCourses"] },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ countCourses: { COUNT: "code" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [{ dept: "cpsc", countCourses: 5001 }]);
    });
    it("POST /api/v2/search should return 422 when kind is invalid for v2", async () => {
        const res = await (0, supertest_1.default)(app).post("/api/v2/search").send({
            kind: "wrong",
            query: {},
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: { kind: "expected to be course_offerings or facilities" },
        });
    });
    it("POST /api/v2/search should return 422 when query is not an object", async () => {
        const res = await (0, supertest_1.default)(app).post("/api/v2/search").send({
            kind: "facilities",
            query: [],
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: { query: "expected an object" },
        });
    });
    it("POST /api/v2/search should allow TRANSFORMATIONS with GROUP and an empty APPLY array", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                    ORDER: "dept",
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [{ dept: "cpsc" }, { dept: "math" }]);
    });
    it("POST /api/v2/search should allow COUNT over a facilities sfield", async () => {
        await seedFacilitiesDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "facilities",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["building", "uniqueTypes"],
                    ORDER: "building",
                },
                TRANSFORMATIONS: {
                    GROUP: ["building"],
                    APPLY: [{ uniqueTypes: { COUNT: "type" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [
            { building: "DMP", uniqueTypes: 2 },
            { building: "ORCH", uniqueTypes: 1 },
        ]);
    });
    it("POST /api/v2/search should return the exact spec-rounded AVG and SUM values", async () => {
        await seedOfferings([
            makeOffering({
                id: 50001,
                Course: "500",
                Subject: "cpsc",
                Professor: "alpha",
                Avg: 0.005,
            }),
            makeOffering({
                id: 50002,
                Course: "501",
                Subject: "cpsc",
                Professor: "beta",
                Avg: 0.02,
            }),
            makeOffering({
                id: 50003,
                Course: "502",
                Subject: "cpsc",
                Professor: "beta",
                Avg: 0.02,
            }),
        ]);
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "avgRounded", "sumAvg", "uniqueInstructors"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [
                        { avgRounded: { AVG: "avg" } },
                        { sumAvg: { SUM: "avg" } },
                        { uniqueInstructors: { COUNT: "instructor" } },
                    ],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", [
            {
                dept: "cpsc",
                avgRounded: 0.01,
                sumAvg: 0.04,
                uniqueInstructors: 2,
            },
        ]);
    });
    it("POST /api/v2/search should return 400 when an ORDER object key is not in COLUMNS", async () => {
        await seedFacilitiesDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "facilities",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["building", "number"],
                    ORDER: {
                        dir: "UP",
                        keys: ["building", "seats"],
                    },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "All ORDER keys must be in COLUMNS",
        });
    });
    it("POST /api/v2/search should return 400 when ORDER keys is an empty array", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "avg"],
                    ORDER: {
                        dir: "UP",
                        keys: [],
                    },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "All ORDER keys must be in COLUMNS",
        });
    });
    it("POST /api/v2/search should return 400 when ORDER keys contains a non-string value", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "avg"],
                    ORDER: {
                        dir: "UP",
                        keys: ["avg", 123],
                    },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "All ORDER keys must be in COLUMNS",
        });
    });
    it("POST /api/v2/search should return 400 when ORDER is neither a string nor an object", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "avg"],
                    ORDER: 7,
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "ORDER must be a key in COLUMNS",
        });
    });
    it("POST /api/v2/search should return 400 when OPTIONS is not an object", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "facilities",
            query: {
                WHERE: {},
                OPTIONS: [],
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "OPTIONS must be an object with COLUMNS and optional ORDER",
        });
    });
    it("POST /api/v2/search should return 400 when TRANSFORMATIONS is not an object", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                },
                TRANSFORMATIONS: [],
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Missing GROUP in TRANSFORMATIONS",
        });
    });
    it("POST /api/v2/search should return 400 when an APPLYRULE has multiple applykeys", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "maxAvg"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [
                        {
                            maxAvg: { MAX: "avg" },
                            minAvg: { MIN: "avg" },
                        },
                    ],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "APPLYRULE must apply aggregation to a valid KEY",
        });
    });
    it("POST /api/v2/search should return 400 when an APPLYRULE body has multiple aggregation tokens", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept", "badRule"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [
                        {
                            badRule: {
                                MAX: "avg",
                                MIN: "avg",
                            },
                        },
                    ],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "APPLYRULE must apply aggregation to a valid KEY",
        });
    });
    it("POST /api/v2/search should return 400 when WHERE contains more than one FILTER", async () => {
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    GT: { avg: 70 },
                    LT: { avg: 90 },
                },
                OPTIONS: {
                    COLUMNS: ["avg"],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "WHERE must be an object with at most one FILTER",
        });
    });
    it("POST /api/v2/search should return 400 when query contains an unexpected top-level key", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                },
                EXTRA: true,
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
    });
    it("POST /api/v2/search should return 400 when TRANSFORMATIONS contains an unexpected key", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [],
                    EXTRA: true,
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
    });
    it("POST /api/v2/search should return 400 when ORDER object contains an unexpected key", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                    ORDER: {
                        dir: "UP",
                        keys: ["dept"],
                        EXTRA: true,
                    },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
    });
    it("POST /api/v2/search should return 400 when GROUP contains an unknown key", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["notAKey"],
                    APPLY: [],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.not.have.nested.property("body.message", "Cannot mix course_offerings and facilities fields in one query");
    });
    it("POST /api/v2/search should return 400 when applykey is empty", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ "": { MAX: "avg" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "applykey cannot be empty or contain underscore",
        });
    });
    it("POST /api/v2/search should return 400 when ORDER object is missing dir", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                    ORDER: {
                        keys: ["dept"],
                    },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "Invalid sort direction (must be UP or DOWN)",
        });
    });
    it("POST /api/v2/search should return 400 when ORDER object is missing keys", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                    ORDER: {
                        dir: "UP",
                    },
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "All ORDER keys must be in COLUMNS",
        });
    });
    it("POST /api/v2/search should return 400 when GT contains more than one key", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    GT: {
                        avg: 70,
                        pass: 10,
                    },
                },
                OPTIONS: {
                    COLUMNS: ["avg"],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "GT must be an object with one mfield of type number",
        });
    });
    it("POST /api/v2/search should return 400 when AND contains a malformed child filter", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    AND: [
                        {
                            GT: { avg: 70 },
                            LT: { avg: 90 },
                        },
                    ],
                },
                OPTIONS: {
                    COLUMNS: ["avg"],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "AND must be a non-empty array of FILTER objects",
        });
    });
    it("POST /api/v2/search should return 400 when GROUP contains a key that is not in COLUMNS", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["maxAvg"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: [{ maxAvg: { MAX: "avg" } }],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
    });
    it("POST /api/v2/search should return 400 when OR is an empty array", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    OR: [],
                },
                OPTIONS: {
                    COLUMNS: ["avg"],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "OR must be a non-empty array of FILTER objects",
        });
    });
    it("POST /api/v2/search should return 400 when NOT is not a FILTER object", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    NOT: 7,
                },
                OPTIONS: {
                    COLUMNS: ["avg"],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "NOT must be a FILTER object",
        });
    });
    it("POST /api/v2/search should return 400 when LT is malformed", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    LT: {
                        avg: "70",
                    },
                },
                OPTIONS: {
                    COLUMNS: ["avg"],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "LT must be an object with one mfield of type number",
        });
    });
    it("POST /api/v2/search should return 400 when EQ is malformed", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {
                    EQ: {
                        avg: "85",
                    },
                },
                OPTIONS: {
                    COLUMNS: ["avg"],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "EQ must be an object with one mfield of type number",
        });
    });
    it("POST /api/v2/search should return 400 with the exact message when GROUP is empty", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                },
                TRANSFORMATIONS: {
                    GROUP: [],
                    APPLY: [],
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "GROUP must be a non-empty array",
        });
    });
    it("POST /api/v2/search should return 400 with the exact message when APPLY is not an array", async () => {
        await seedSearchDataset();
        const res = await (0, supertest_1.default)(app)
            .post("/api/v2/search")
            .send({
            kind: "course_offerings",
            query: {
                WHERE: {},
                OPTIONS: {
                    COLUMNS: ["dept"],
                },
                TRANSFORMATIONS: {
                    GROUP: ["dept"],
                    APPLY: {},
                },
            },
        });
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Invalid query",
            message: "APPLY must be an array",
        });
    });
    it("GET /api/v1/courses should return 200 with default pagination on an empty course list", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", { total: 0, limit: 100, offset: 0, items: [] });
    });
    it("GET /api/v1/courses?limit=100&offset=0 should return 200 with an empty course list", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", { total: 0, limit: 100, offset: 0, items: [] });
    });
    it("GET /api/v1/courses should paginate using limit and offset", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc110").send({
            title: "Computation, Programs, and Programming",
            dept: "Computer Science",
            code: "110",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc210").send({
            title: "Software Construction",
            dept: "Computer Science",
            code: "210",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const pageRes = await (0, supertest_1.default)(app).get("/api/v1/courses?limit=1&offset=1");
        (0, chai_1.expect)(pageRes).to.have.property("status", 200);
        (0, chai_1.expect)(pageRes.body).to.have.property("total", 3);
        (0, chai_1.expect)(pageRes.body).to.have.property("limit", 1);
        (0, chai_1.expect)(pageRes.body).to.have.property("offset", 1);
        (0, chai_1.expect)(pageRes.body.items).to.deep.equal([
            {
                id: "cpsc210",
                title: "Software Construction",
                dept: "Computer Science",
                code: "210",
                links: { self: "/api/v1/courses/cpsc210", sections: "/api/v1/courses/cpsc210/sections" },
            },
        ]);
        const emptyPageRes = await (0, supertest_1.default)(app).get("/api/v1/courses?limit=10&offset=99");
        (0, chai_1.expect)(emptyPageRes).to.have.property("status", 200);
        (0, chai_1.expect)(emptyPageRes.body).to.have.property("total", 3);
        (0, chai_1.expect)(emptyPageRes.body.items).to.deep.equal([]);
    });
    it("GET /api/v1/courses should include created course ids in paginated results", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc210").send({
            title: "Software Construction",
            dept: "Computer Science",
            code: "210",
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.have.property("total", 2);
        (0, chai_1.expect)(res.body.items.map((item) => item.id)).to.have.members(["cpsc210", "cpsc310"]);
    });
    it("GET /api/v1/courses?limit=0&offset=0 should return 400 for an invalid limit", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses?limit=0&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v1/courses?limit=100&offset=-1 should return 400 for an invalid offset", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses?limit=100&offset=-1");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v1/courses should return 400 when both limit and offset are invalid", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses?limit=0&offset=-1");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v1/courses should return 400 when limit is not an integer (e.g., 1.5)", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses?limit=1.5&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body.params).to.have.property("limit");
    });
    it("GET /api/v1/courses/cpsc310 should return 200 with the course resource", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "cpsc310",
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
            links: { self: "/api/v1/courses/cpsc310", sections: "/api/v1/courses/cpsc310/sections" },
        });
    });
    it("GET /api/v1/courses/cpsc999 should return 404 when the course does not exist", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc999");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no course with id 'cpsc999'",
        });
    });
    it("PUT /api/v1/courses/cpsc310 should return 201 with the created course resource", async () => {
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        (0, chai_1.expect)(res).to.have.property("status", 201);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "cpsc310",
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
            links: { self: "/api/v1/courses/cpsc310", sections: "/api/v1/courses/cpsc310/sections" },
        });
    });
    it("PUT /api/v1/courses/cpsc310 should return 204 and preserve existing sections when updating a course", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Old Title",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "New Title",
            dept: "Computer Science",
            code: "310",
        });
        (0, chai_1.expect)(res).to.have.property("status", 204);
        (0, chai_1.expect)(res.text).to.equal("");
        const courseRes = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310");
        (0, chai_1.expect)(courseRes).to.have.property("status", 200);
        (0, chai_1.expect)(courseRes).to.have.nested.property("body.title", "New Title");
        const secRes = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections/21w201");
        (0, chai_1.expect)(secRes).to.have.property("status", 200);
        (0, chai_1.expect)(secRes).to.have.nested.property("body.id", "21w201");
    });
    it("PUT /api/v1/courses/cpsc310 should return 422 when required fields are missing or invalid types", async () => {
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: null,
            dept: 123,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Validation failed");
        (0, chai_1.expect)(res.body.fields).to.be.an("object");
        (0, chai_1.expect)(Object.keys(res.body.fields)).to.not.be.empty;
    });
    it("DELETE /api/v1/courses/cpsc310 should return 200 with deleted course metadata and section count", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w202").send({
            instructor: "bradley, nick",
            year: 2021,
            avg: 77.1,
            pass: 172,
            fail: 1,
            audit: 0,
        });
        const res = await (0, supertest_1.default)(app).delete("/api/v1/courses/cpsc310");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.include({
            id: "cpsc310",
            title: "Introduction to Software Engineering",
        });
        (0, chai_1.expect)(res.body).to.have.property("sections");
    });
    it("DELETE /api/v1/courses/cpsc310 should return 404 when the course does not exist", async () => {
        const res = await (0, supertest_1.default)(app).delete("/api/v1/courses/cpsc310");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no course with id 'cpsc310'",
        });
    });
    it("GET /api/v1/courses/cpsc310/sections?limit=100&offset=0 should respond with status 200 and body = list of sections", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w202").send({
            instructor: "bradley, nick",
            year: 2021,
            avg: 77.1,
            pass: 172,
            fail: 1,
            audit: 0,
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            total: 2,
            limit: 100,
            offset: 0,
            items: [
                {
                    id: "21w201",
                    instructor: "holmes, reid",
                    year: 2021,
                    avg: 76.4,
                    pass: 167,
                    fail: 3,
                    audit: 1,
                    links: { self: "/api/v1/courses/cpsc310/sections/21w201", course: "/api/v1/courses/cpsc310" },
                },
                {
                    id: "21w202",
                    instructor: "bradley, nick",
                    year: 2021,
                    avg: 77.1,
                    pass: 172,
                    fail: 1,
                    audit: 0,
                    links: { self: "/api/v1/courses/cpsc310/sections/21w202", course: "/api/v1/courses/cpsc310" },
                },
            ],
        });
    });
    it("GET /api/v1/courses/cpsc310/sections?limit=0&offset=0 should respond with status 400 and validation error for limit", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections?limit=0&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v1/courses/cpsc310/sections?limit=5001&offset=0 should respond with status 400 and validation error for limit", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections?limit=5001&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v1/courses/cpsc310/sections?limit=100&offset=-1 should respond with status 400 and validation error for offset", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=-1");
        (0, chai_1.expect)(res).to.have.property("status", 400);
        (0, chai_1.expect)(res.body).to.have.property("error");
    });
    it("GET /api/v1/courses/cpsc310/sections?limit=100&offset=0 should respond with status 404 when course does not exist", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Not found");
        (0, chai_1.expect)(res).to.have.nested.property("body.message");
        (0, chai_1.expect)(res.body.message).to.be.a("string").and.not.equal("");
    });
    it("GET /api/v1/courses/cpsc310/sections should respond with status 200 and default pagination", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body).to.have.property("total", 1);
        (0, chai_1.expect)(res.body).to.have.property("limit", 100);
        (0, chai_1.expect)(res.body).to.have.property("offset", 0);
        (0, chai_1.expect)(res.body.items).to.be.an("array").with.length(1);
    });
    it("GET /api/v1/courses/cpsc310/sections?limit=100&offset=0 should include created section ids", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/z-last").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/a-first").send({
            instructor: "bradley, nick",
            year: 2021,
            avg: 77.1,
            pass: 172,
            fail: 1,
            audit: 0,
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=0");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res.body.items.map((item) => item.id)).to.have.members(["a-first", "z-last"]);
    });
    it("GET /api/v1/courses/cpsc310/sections/21w201 should respond with status 200 and body = section", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections/21w201");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "21w201",
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
            links: {
                self: "/api/v1/courses/cpsc310/sections/21w201",
                course: "/api/v1/courses/cpsc310",
            },
        });
    });
    it("GET /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when course does not exist", async () => {
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections/21w201");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no course with id 'cpsc310'",
        });
    });
    it("GET /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when section does not exist", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections/21w201");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no section with id '21w201'",
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 201 and body = created section", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 201);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "21w201",
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
            links: {
                self: "/api/v1/courses/cpsc310/sections/21w201",
                course: "/api/v1/courses/cpsc310",
            },
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 204 and no body when updating section", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "skeens, paul",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 204);
        (0, chai_1.expect)(res.text).to.equal("");
        const resDoubleCheck = await (0, supertest_1.default)(app).get("/api/v1/courses/cpsc310/sections/21w201");
        (0, chai_1.expect)(resDoubleCheck).to.have.property("status", 200);
        (0, chai_1.expect)(resDoubleCheck).to.have.deep.property("body", {
            id: "21w201",
            instructor: "skeens, paul",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
            links: {
                self: "/api/v1/courses/cpsc310/sections/21w201",
                course: "/api/v1/courses/cpsc310",
            },
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when course does not exist", async () => {
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no course with id 'cpsc310'",
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 and body = validation error (missing instructor + invalid numbers)", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            year: 1899,
            avg: 300,
            pass: 167,
            fail: -3,
            audit: 1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                instructor: "required but missing",
                year: "expected a number between 1900 and 2099",
                avg: "expected a number between 0 and 100",
                fail: "expected a number >= 0",
            },
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 and body = validation error (invalid numbers only)", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2100,
            avg: -1,
            pass: 167,
            fail: -3,
            audit: 1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                year: "expected a number between 1900 and 2099",
                avg: "expected a number between 0 and 100",
                fail: "expected a number >= 0",
            },
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 when year is fractional", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021.5,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                year: "expected a number between 1900 and 2099",
            },
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/minedge should respond with status 201 at inclusive lower bounds", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/minedge").send({
            instructor: "holmes, reid",
            year: 1900,
            avg: 0,
            pass: 0,
            fail: 0,
            audit: 0,
        });
        (0, chai_1.expect)(res).to.have.property("status", 201);
        (0, chai_1.expect)(res.body).to.have.property("year", 1900);
        (0, chai_1.expect)(res.body).to.have.property("avg", 0);
        (0, chai_1.expect)(res.body).to.have.property("pass", 0);
        (0, chai_1.expect)(res.body).to.have.property("fail", 0);
        (0, chai_1.expect)(res.body).to.have.property("audit", 0);
    });
    it("PUT /api/v1/courses/cpsc310/sections/maxedge should respond with status 201 at inclusive upper bounds", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/maxedge").send({
            instructor: "holmes, reid",
            year: 2099,
            avg: 100,
            pass: 1,
            fail: 0,
            audit: 0,
        });
        (0, chai_1.expect)(res).to.have.property("status", 201);
        (0, chai_1.expect)(res.body).to.have.property("year", 2099);
        (0, chai_1.expect)(res.body).to.have.property("avg", 100);
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 when pass/fail/audit are fractional", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167.2,
            fail: 3.1,
            audit: 1.7,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                pass: "expected a number >= 0",
                fail: "expected a number >= 0",
                audit: "expected a number >= 0",
            },
        });
    });
    it("PUT /api/v1/courses/cpsc999/sections/21w201 should respond with status 404 even if body is invalid", async () => {
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc999/sections/21w201").send({
            year: 1800,
            avg: -1,
            pass: -1,
            fail: -1,
            audit: -1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no course with id 'cpsc999'",
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 and body = validation error (missing instructor only)", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Validation failed",
            fields: {
                instructor: "required but missing",
            },
        });
    });
    it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 when required fields are null", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: null,
            year: null,
            avg: null,
            pass: null,
            fail: null,
            audit: null,
        });
        (0, chai_1.expect)(res).to.have.property("status", 422);
        (0, chai_1.expect)(res).to.have.nested.property("body.error", "Validation failed");
        (0, chai_1.expect)(res.body.fields).to.be.an("object");
        (0, chai_1.expect)(Object.keys(res.body.fields)).to.not.be.empty;
    });
    it("DELETE /api/v1/courses/cpsc310/sections/21w201 should respond with status 200 and body = deleted section", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
        const res = await (0, supertest_1.default)(app).delete("/api/v1/courses/cpsc310/sections/21w201");
        (0, chai_1.expect)(res).to.have.property("status", 200);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            id: "21w201",
            instructor: "holmes, reid",
            year: 2021,
            avg: 76.4,
            pass: 167,
            fail: 3,
            audit: 1,
        });
    });
    it("DELETE /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when course does not exist", async () => {
        const res = await (0, supertest_1.default)(app).delete("/api/v1/courses/cpsc310/sections/21w201");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no course with id 'cpsc310'",
        });
    });
    it("DELETE /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when section does not exist", async () => {
        await (0, supertest_1.default)(app).put("/api/v1/courses/cpsc310").send({
            title: "Introduction to Software Engineering",
            dept: "Computer Science",
            code: "310",
        });
        const res = await (0, supertest_1.default)(app).delete("/api/v1/courses/cpsc310/sections/21w201");
        (0, chai_1.expect)(res).to.have.property("status", 404);
        (0, chai_1.expect)(res).to.have.deep.property("body", {
            error: "Not found",
            message: "no section with id '21w201'",
        });
    });
});
//# sourceMappingURL=App.spec.js.map