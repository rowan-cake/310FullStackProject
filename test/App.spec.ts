import fs from "fs/promises";
import { expect } from "chai";
import request from "supertest";
import { StatusCodes } from "http-status-codes";
import { Application, createApp } from "../src/App";
import JSZip from "jszip";

const { OK } = StatusCodes;

const datadir = "./data" as const;

describe("REST API v1", function () {
	let app: Application;
	let originalFetch: typeof fetch;

	type GeoLookupResult = { lat?: number; lon?: number; error?: string };
	type GeoLookup = (address: string) => Promise<GeoLookupResult>;

	function setGeolocationLookup(lookup: GeoLookup) {
		globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
			const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			const pathname = new URL(rawUrl).pathname;
			const address = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1));
			const payload = await lookup(address);
			return { json: async () => payload } as Response;
		}) as typeof fetch;
	}

	before(() => {
		originalFetch = globalThis.fetch;
	});

	beforeEach(async () => {
		setGeolocationLookup(async () => ({ error: "not configured" }));
		app = await createApp({ datadir });
	});

	afterEach(async () => {
		globalThis.fetch = originalFetch;
		await fs.rm(datadir, { recursive: true, force: true });
	});

	type ZipEntry = {
		path: string;
		content: string | Buffer | Record<string, unknown>;
	};

	// Builds a default course offering record with optional field overrides.
	function makeOffering(overrides: Partial<Record<string, unknown>> = {}) {
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

	// Creates an in-memory zip Buffer from a list of {path, content} entries.
	async function makeZip(entries: ZipEntry[]): Promise<Buffer> {
		const zip = new JSZip();
		for (const entry of entries) {
			const content =
				typeof entry.content === "string" || Buffer.isBuffer(entry.content)
					? entry.content
					: JSON.stringify(entry.content);
			zip.file(entry.path, content);
		}
		return zip.generateAsync({ type: "nodebuffer" });
	}

	// Uploads a zip dataset to POST /api/v1/datasets using the given kind (default: course_offerings).
	async function postDataset(entries: ZipEntry[], kind = "course_offerings") {
		const zipBuffer = await makeZip(entries);
		return request(app).post("/api/v1/datasets").field("kind", kind).attach("archive", zipBuffer, "courses.zip");
	}

	// Uploads a zip dataset to POST /api/v2/datasets using the given kind.
	async function postDatasetV2(entries: ZipEntry[], kind: "course_offerings" | "facilities") {
		const zipBuffer = await makeZip(entries);
		return request(app).post("/api/v2/datasets").field("kind", kind).attach("archive", zipBuffer, "dataset.zip");
	}

	// Polls GET /api/v1/datasets/{id} until the job reaches completed/failed (or times out).
	async function waitForDatasetTerminalStatus(uploadId: string) {
		let res = await request(app).get(`/api/v1/datasets/${uploadId}`);
		for (let i = 0; i < 80 && res.status === 200 && res.body.status === "processing"; i++) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			res = await request(app).get(`/api/v1/datasets/${uploadId}`);
		}
		return res;
	}

	// Convenience wrapper: POST dataset then wait until the upload job is completed/failed.
	async function uploadDatasetAndWait(entries: ZipEntry[]) {
		const postRes = await postDataset(entries);
		expect(postRes).to.have.property("status", 202);
		const uploadId = postRes.body.id as string;
		const statusRes = await waitForDatasetTerminalStatus(uploadId);
		return { postRes, uploadId, statusRes };
	}

	async function waitForDatasetTerminalStatusV2(uploadId: string) {
		let res = await request(app).get(`/api/v2/datasets/${uploadId}`);
		for (let i = 0; i < 80 && res.status === 200 && res.body.status === "processing"; i++) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			res = await request(app).get(`/api/v2/datasets/${uploadId}`);
		}
		return res;
	}

	function makeFacilitiesZip(): ZipEntry[] {
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

	function makeBuilding(overrides: Partial<Record<string, unknown>> = {}) {
		return {
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			...overrides,
		};
	}

	function makeRoom(overrides: Partial<Record<string, unknown>> = {}) {
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

	// Seeds a small dataset (3 offerings) for deterministic search endpoint tests.
	async function seedOfferings(records: Array<Record<string, unknown>>) {
		const { statusRes } = await uploadDatasetAndWait([
			{
				path: "courses/one.json",
				content: {
					result: records,
				},
			},
		]);
		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.status", "completed");
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

	// Seeds a small facilities dataset via the public v2 building/room endpoints.
	async function seedFacilitiesDataset() {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await request(app).put("/api/v2/buildings/ORCH").send({
			name: "Orchard Commons",
			address: "6363 Agronomy Road",
			lat: 49.26048,
			lon: -123.25027,
		});
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
		await request(app)
			.put("/api/v2/buildings/DMP/rooms/DMP_201")
			.send(
				makeRoom({
					number: "201",
					type: "Small Group",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-201",
					seats: 25,
				})
			);
		await request(app).put("/api/v2/buildings/ORCH/rooms/ORCH_300").send({
			building: "ORCH",
			number: "300",
			type: "Tiered Large Group",
			furniture: "Fixed Tables/Fixed Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ORCH-300",
			seats: 120,
		});
	}

	// ============================================================
	// Smoke / non-spec routes
	// ============================================================

	// 200 — healthcheck route returns running text
	it("GET /api should respond with status OK and text 'App is running!'", async () => {
		const res = await request(app).get("/api");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.property("text", "App is running!");
	});

	// ============================================================
	// POST /api/v1/datasets (202, 422)
	// Bulk upload data
	// ============================================================

	// 202 — accepts valid dataset upload and returns processing job
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

		expect(res).to.have.property("status", 202);
		expect(res).to.have.nested.property("body.id");
		expect(res.body.id).to.be.a("string").and.not.equal("");
		expect(res).to.have.nested.property("body.status", "processing");
		expect(res).to.have.nested.property("body.kind", "course_offerings");
		expect(res).to.have.nested.property("body.message", "Dataset accepted for processing");

		await waitForDatasetTerminalStatus(res.body.id as string);
	});

	// 422 — rejects missing kind field
	it("POST /api/v1/datasets should return 422 when kind is missing", async () => {
		const zipBuffer = await makeZip([
			{
				path: "courses/one.json",
				content: { result: [makeOffering()] },
			},
		]);

		const res = await request(app).post("/api/v1/datasets").attach("archive", zipBuffer, "courses.zip");

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { kind: "required but missing" },
		});
	});

	// 422 — rejects invalid kind field value
	it("POST /api/v1/datasets should return 422 when kind is invalid", async () => {
		const zipBuffer = await makeZip([
			{
				path: "courses/one.json",
				content: { result: [makeOffering()] },
			},
		]);

		const res = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "not_course_offerings")
			.attach("archive", zipBuffer, "courses.zip");

		expect(res).to.have.property("status", 422);
		expect(res).to.have.nested.property("body.error", "Validation failed");
		expect(res.body.fields).to.have.property("kind");
	});

	// 422 — rejects missing archive file
	it("POST /api/v1/datasets should return 422 when archive is missing", async () => {
		const res = await request(app).post("/api/v1/datasets").field("kind", "course_offerings");

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { archive: "required but missing" },
		});
	});

	// 422 — rejects empty archive file
	it("POST /api/v1/datasets should return 422 when archive is empty", async () => {
		const res = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", Buffer.alloc(0), "courses.zip");

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { archive: "expected non-empty file" },
		});
	});

	// 422 — rejects invalid kind and empty archive
	it("POST /api/v1/datasets should return 422 with both errors when kind is wrong and archive is empty", async () => {
		const res = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "wrong")
			.attach("archive", Buffer.alloc(0), "courses.zip");

		expect(res).to.have.property("status", 422);
		expect(res).to.have.nested.property("body.error", "Validation failed");
		expect(res.body.fields).to.have.property("kind");
		expect(res.body.fields).to.have.property("archive");
	});

	// 202->failed — non-zip uploads eventually fail with invalid zip message
	it("POST /api/v1/datasets should eventually fail with 'Data is not in a valid zip format' for non-zip data", async () => {
		const postRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", Buffer.from("not a zip"), "courses.zip");

		expect(postRes).to.have.property("status", 202);
		expect(postRes).to.have.nested.property("body.status", "processing");

		const res = await waitForDatasetTerminalStatus(postRes.body.id as string);

		expect(res).to.have.property("status", 200);
		expect(res).to.have.nested.property("body.status", "failed");
		expect(res).to.have.nested.property("body.message", "Data is not in a valid zip format");
	});

	// 202->failed — missing root courses/ directory eventually fails
	it("POST /api/v1/datasets should eventually fail with 'Missing root courses directory' when courses/ is missing", async () => {
		const postRes = await postDataset([
			{
				path: "one.json",
				content: { result: [makeOffering()] },
			},
		]);

		expect(postRes).to.have.property("status", 202);

		const res = await waitForDatasetTerminalStatus(postRes.body.id as string);

		expect(res).to.have.property("status", 200);
		expect(res).to.have.nested.property("body.status", "failed");
		expect(res).to.have.nested.property("body.message", "Missing root courses directory");
	});

	// 202->completed — skips valid JSON files without result property
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

		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.id", uploadId);
		expect(statusRes).to.have.nested.property("body.status", "completed");
		expect(statusRes).to.have.nested.property("body.message", "Dataset processing complete");
		expect(statusRes).to.have.deep.nested.property("body.stats", {
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

	// 202->completed — skips invalid records in result arrays while processing valid ones
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

		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.status", "completed");

		const sectionsRes = await request(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=0");
		expect(sectionsRes).to.have.property("status", 200);
		expect(sectionsRes.body).to.have.property("total", 1);
		expect(sectionsRes.body.items).to.be.an("array").with.length(1);
		expect(sectionsRes.body.items[0]).to.have.property("id", "99901");

		const missingInvalidRes = await request(app).get("/api/v1/courses/cpsc310/sections/99903");
		expect(missingInvalidRes).to.have.property("status", 404);
	});

	// 202->completed — course title uses most recent offering title
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

		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.status", "completed");

		const courseRes = await request(app).get("/api/v1/courses/cpsc310");
		expect(courseRes).to.have.property("status", 200);
		expect(courseRes).to.have.nested.property("body.title", "New Title");
	});

	// 202->completed — section year converts to 1900 when Section is overall
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

		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.status", "completed");

		const secRes = await request(app).get("/api/v1/courses/cpsc310/sections/12345");
		expect(secRes).to.have.property("status", 200);
		expect(secRes).to.have.nested.property("body.year", 1900);
	});

	// 202->completed — later upload counts modified courses/sections
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

		expect(first.statusRes).to.have.nested.property("body.status", "completed");

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

		expect(second.statusRes).to.have.property("status", 200);
		expect(second.statusRes).to.have.nested.property("body.status", "completed");
		expect(second.statusRes).to.have.deep.nested.property("body.stats", {
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

		const courseRes = await request(app).get("/api/v1/courses/cpsc310");
		expect(courseRes).to.have.property("status", 200);
		expect(courseRes).to.have.nested.property("body.title", "New Title");

		const secRes = await request(app).get("/api/v1/courses/cpsc310/sections/77777");
		expect(secRes).to.have.property("status", 200);
		expect(secRes).to.have.nested.property("body.avg", 88);
	});

	// 202->completed — later identical upload does not count unchanged resources as modified
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

		expect(second.statusRes).to.have.property("status", 200);
		expect(second.statusRes).to.have.nested.property("body.status", "completed");
		expect(second.statusRes).to.have.deep.nested.property("body.stats", {
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

	// ============================================================
	// GET /api/v1/datasets/{id} (200, 404)
	// Retrieve upload statistics
	// ============================================================

	// 200 — returns completed upload stats after processing finishes
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

		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.id", uploadId);
		expect(statusRes).to.have.nested.property("body.status", "completed");
		expect(statusRes).to.have.nested.property("body.kind", "course_offerings");
		expect(statusRes).to.have.nested.property("body.message", "Dataset processing complete");
		expect(statusRes).to.have.deep.nested.property("body.stats", {
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

	// 200 — returns processing/completed payload immediately after upload submission
	it("GET /api/v1/datasets/{id} should return a valid status payload immediately after upload submission", async () => {
		const postRes = await postDataset([
			{
				path: "courses/one.json",
				content: { result: [makeOffering()] },
			},
		]);

		expect(postRes).to.have.property("status", 202);
		const uploadId = postRes.body.id as string;

		const res = await request(app).get(`/api/v1/datasets/${uploadId}`);
		expect(res).to.have.property("status", 200);
		expect(res).to.have.nested.property("body.id", uploadId);
		expect(res).to.have.nested.property("body.kind", "course_offerings");

		if (res.body.status === "processing") {
			expect(res).to.have.nested.property("body.message", "Processing in progress");
			expect(res).to.have.deep.nested.property("body.stats", {
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
		} else if (res.body.status === "completed") {
			expect(res).to.have.nested.property("body.message", "Dataset processing complete");
		} else {
			expect.fail(`Unexpected dataset status immediately after upload: ${String(res.body.status)}`);
		}

		await waitForDatasetTerminalStatus(uploadId);
	});

	// 404 — rejects unknown dataset upload id
	it("GET /api/v1/datasets/{id} should return 404 when the dataset upload id does not exist", async () => {
		const res = await request(app).get("/api/v1/datasets/upload_does_not_exist");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.nested.property("body.error", "Not found");
		expect(res).to.have.nested.property("body.message");
		expect(res.body.message).to.be.a("string").and.not.equal("");
	});

	// ============================================================
	// POST /api/v2/datasets (202, 422)
	// Bulk upload data
	// ============================================================

	it("POST /api/v2/datasets should accept a facilities upload and create a processing job", async () => {
		setGeolocationLookup(async (address: string) => {
			if (address === "6245 Agronomy Road V6T 1Z4") {
				return { lat: 49.26125, lon: -123.24807 };
			}
			return { error: "missing" };
		});

		const postRes = await postDatasetV2(makeFacilitiesZip(), "facilities");
		expect(postRes).to.have.property("status", 202);
		expect(postRes).to.have.nested.property("body.kind", "facilities");
		expect(postRes).to.have.nested.property("body.status", "processing");

		const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id as string);
		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.status", "completed");
		expect(statusRes).to.have.nested.property("body.kind", "facilities");
		expect(statusRes).to.have.deep.nested.property("body.stats", {
			buildings_added: 1,
			buildings_modified: 0,
			rooms_added: 1,
			rooms_modified: 0,
		});
	});

	it("POST /api/v2/datasets should return 422 when kind is invalid for v2", async () => {
		const zipBuffer = await makeZip(makeFacilitiesZip());
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "wrong")
			.attach("archive", zipBuffer, "dataset.zip");

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { kind: "expected to be course_offerings or facilities" },
		});
	});

	it("POST /api/v2/datasets should eventually fail when index.htm is missing", async () => {
		const postRes = await postDatasetV2(
			[
				{
					path: "rooms.htm",
					content: "<html><body>no index</body></html>",
				},
			],
			"facilities"
		);

		expect(postRes).to.have.property("status", 202);

		const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id as string);
		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.status", "failed");
		expect(statusRes).to.have.nested.property("body.message", "Missing index.htm file");
	});

	it("POST /api/v2/datasets should accept course_offerings uploads with the v2 contract", async () => {
		const postRes = await postDatasetV2(
			[
				{
					path: "courses/one.json",
					content: { result: [makeOffering()] },
				},
			],
			"course_offerings"
		);

		expect(postRes).to.have.property("status", 202);
		expect(postRes).to.have.nested.property("body.kind", "course_offerings");
		expect(postRes).to.have.nested.property("body.status", "processing");
		expect(postRes).to.have.nested.property("body.message", "Dataset accepted for processing");

		const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id as string);
		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.status", "completed");
		expect(statusRes).to.have.nested.property("body.kind", "course_offerings");
		expect(statusRes).to.have.deep.nested.property("body.stats", {
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
		const res = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "wrong")
			.attach("archive", Buffer.alloc(0), "dataset.zip");

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "expected to be course_offerings or facilities",
				archive: "expected non-empty file",
			},
		});
	});

	it("POST /api/v2/datasets should fail when index.htm has no building table", async () => {
		setGeolocationLookup(async () => ({ lat: 49.26125, lon: -123.24807 }));

		const postRes = await postDatasetV2(
			[
				{
					path: "index.htm",
					content: "<html><body><div>no table here</div></body></html>",
				},
			],
			"facilities"
		);

		expect(postRes).to.have.property("status", 202);

		const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id as string);
		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.status", "failed");
		expect(statusRes).to.have.nested.property("body.message", "No building table found in index.htm");
	});

	// ============================================================
	// GET /api/v2/datasets/{id} (200, 404)
	// Retrieve upload statistics
	// ============================================================

	it("GET /api/v2/datasets/{id} should return facilities processing stats after completion", async () => {
		setGeolocationLookup(async () => ({ lat: 49.26125, lon: -123.24807 }));

		const postRes = await postDatasetV2(makeFacilitiesZip(), "facilities");
		expect(postRes).to.have.property("status", 202);

		const statusRes = await waitForDatasetTerminalStatusV2(postRes.body.id as string);
		expect(statusRes).to.have.property("status", 200);
		expect(statusRes).to.have.nested.property("body.kind", "facilities");
		expect(statusRes).to.have.nested.property("body.message", "Dataset processing complete");
		expect(statusRes.body.stats).to.have.property("buildings_added", 1);
		expect(statusRes.body.stats).to.have.property("rooms_added", 1);
	});

	it("GET /api/v2/datasets/{id} should return 404 when the dataset id does not exist", async () => {
		const res = await request(app).get("/api/v2/datasets/upload_missing");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
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
		expect(postRes).to.have.property("status", 202);

		const res = await request(app).get(`/api/v2/datasets/${postRes.body.id as string}`);
		expect(res).to.have.property("status", 200);
		expect(res).to.have.nested.property("body.kind", "facilities");

		if (res.body.status === "processing") {
			expect(res).to.have.nested.property("body.message", "Processing in progress");
			expect(res).to.have.deep.nested.property("body.stats", {
				buildings_added: 0,
				buildings_modified: 0,
				rooms_added: 0,
				rooms_modified: 0,
			});
		} else {
			expect(res).to.have.nested.property("body.status", "completed");
		}

		await waitForDatasetTerminalStatusV2(postRes.body.id as string);
	});

	// ============================================================
	// PUT /api/v2/buildings/{building} (201, 204, 422)
	// Create or replace a building
	// ============================================================

	it("PUT /api/v2/buildings/DMP should return 201 with the created building resource", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		expect(res).to.have.property("status", 201);
		expect(res).to.have.deep.property("body", {
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
		const first = await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		expect(first).to.have.property("status", 201);

		const res = await request(app)
			.put("/api/v2/buildings/DMP")
			.send(
				makeBuilding({
					name: "Hugh Dempster Pavilion Updated",
					lat: 49.2,
					lon: -123.2,
				})
			);

		expect(res).to.have.property("status", 204);
		expect(res.text).to.equal("");
	});

	it("PUT /api/v2/buildings/DMP should return 422 when required fields are missing or invalid", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP").send({
			address: 123,
			lon: "west",
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
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
		const res = await request(app)
			.put("/api/v2/buildings/DMP")
			.send(
				makeBuilding({
					lat: Number.NaN,
					lon: Number.POSITIVE_INFINITY,
				})
			);

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				lat: "expected a number",
				lon: "expected a number",
			},
		});
	});

	// ============================================================
	// GET /api/v2/buildings (200, 400)
	// Retrieve a list of buildings
	// ============================================================

	it("GET /api/v2/buildings should return 200 with default pagination on an empty building list", async () => {
		const res = await request(app).get("/api/v2/buildings");

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
			total: 0,
			limit: 100,
			offset: 0,
			items: [],
		});
	});

	it("GET /api/v2/buildings?limit=100&offset=0 should return 200 with an empty building list", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=100&offset=0");

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
			total: 0,
			limit: 100,
			offset: 0,
			items: [],
		});
	});

	it("GET /api/v2/buildings should paginate using limit and offset", async () => {
		await request(app).put("/api/v2/buildings/ANGU").send({
			name: "Angus Building",
			address: "2053 Main Mall",
			lat: 49.26486,
			lon: -123.25302,
		});
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await request(app).put("/api/v2/buildings/ORCH").send({
			name: "Orchard Commons",
			address: "6363 Agronomy Road",
			lat: 49.26048,
			lon: -123.25027,
		});

		const pageRes = await request(app).get("/api/v2/buildings?limit=1&offset=1");
		expect(pageRes).to.have.property("status", 200);
		expect(pageRes.body).to.have.property("total", 3);
		expect(pageRes.body).to.have.property("limit", 1);
		expect(pageRes.body).to.have.property("offset", 1);
		expect(pageRes.body.items).to.deep.equal([
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

		const emptyPageRes = await request(app).get("/api/v2/buildings?limit=10&offset=99");
		expect(emptyPageRes).to.have.property("status", 200);
		expect(emptyPageRes.body).to.have.property("total", 3);
		expect(emptyPageRes.body.items).to.deep.equal([]);
	});

	it("GET /api/v2/buildings should include created building ids in paginated results", async () => {
		await request(app).put("/api/v2/buildings/ORCH").send({
			name: "Orchard Commons",
			address: "6363 Agronomy Road",
			lat: 49.26048,
			lon: -123.25027,
		});
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).get("/api/v2/buildings?limit=100&offset=0");

		expect(res).to.have.property("status", 200);
		expect(res.body).to.have.property("total", 2);
		expect(res.body.items).to.be.an("array").with.length(2);
		expect(res.body.items.map((item: any) => item.id)).to.have.members(["DMP", "ORCH"]);
	});

	it("GET /api/v2/buildings?limit=0&offset=0 should return 400 for an invalid limit", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=0&offset=0");

		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	it("GET /api/v2/buildings?limit=100&offset=-1 should return 400 for an invalid offset", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=100&offset=-1");

		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	it("GET /api/v2/buildings should return 400 when both limit and offset are invalid", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=0&offset=-1");

		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	it("GET /api/v2/buildings should return 400 when limit is not an integer (e.g., 1.5)", async () => {
		const res = await request(app).get("/api/v2/buildings?limit=1.5&offset=0");

		expect(res).to.have.property("status", 400);
		expect(res.body.params).to.have.property("limit");
	});

	// ============================================================
	// GET /api/v2/buildings/{building} (200, 404)
	// Retrieve a building
	// ============================================================

	// 200 — returns the full building resource with v2 links
	it("GET /api/v2/buildings/DMP should return 200 with the building resource", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).get("/api/v2/buildings/DMP");

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
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

	// 404 — rejects a missing building id with the spec message
	it("GET /api/v2/buildings/DMP should return 404 when the building does not exist", async () => {
		const res = await request(app).get("/api/v2/buildings/DMP");

		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	// ============================================================
	// DELETE /api/v2/buildings/{building} (200, 404)
	// Remove a building
	// ============================================================

	// 200 — deletes the building and reports how many rooms were removed with it
	it("DELETE /api/v2/buildings/DMP should return 200 with deleted building metadata and room count", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await fs.mkdir(`${datadir}`, { recursive: true });
		await fs.writeFile(
			`${datadir}/database.json`,
			JSON.stringify({
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
			}),
			"utf8"
		);

		const res = await request(app).delete("/api/v2/buildings/DMP");

		expect(res).to.have.property("status", 200);
		expect(res.body).to.include({
			id: "DMP",
			name: "Hugh Dempster Pavilion",
		});
		expect(res.body).to.have.property("rooms");
	});

	// 200 — reports zero removed rooms when the building has no rooms
	it("DELETE /api/v2/buildings/ORCH should return 200 with zero rooms when the building has no rooms", async () => {
		await request(app).put("/api/v2/buildings/ORCH").send({
			name: "Orchard Commons",
			address: "6363 Agronomy Road",
			lat: 49.26048,
			lon: -123.25027,
		});

		const res = await request(app).delete("/api/v2/buildings/ORCH");

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
			id: "ORCH",
			name: "Orchard Commons",
			address: "6363 Agronomy Road",
			lat: 49.26048,
			lon: -123.25027,
			rooms: 0,
		});
	});

	// 404 — rejects deleting a missing building id
	it("DELETE /api/v2/buildings/DMP should return 404 when the building does not exist", async () => {
		const res = await request(app).delete("/api/v2/buildings/DMP");

		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	// ============================================================
	// PUT /api/v2/buildings/{building}/rooms/{room} (201, 204, 404, 422)
	// Create or replace a room for a building
	// ============================================================

	// 201 — creates a room and returns the created resource with links
	it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 201 with the created room resource", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());

		expect(res).to.have.property("status", 201);
		expect(res).to.have.deep.property("body", {
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

	// 204 — replaces an existing room and returns no content
	it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 204 when updating an existing room", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());

		const res = await request(app)
			.put("/api/v2/buildings/DMP/rooms/DMP_101")
			.send(
				makeRoom({
					type: "Small Group",
					furniture: "Tables and Chairs",
					seats: 12,
				})
			);

		expect(res).to.have.property("status", 204);
		expect(res.text).to.equal("");
	});

	// 404 — missing parent building takes precedence over any payload validation issues
	it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the building does not exist", async () => {
		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());

		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	// 422 — rejects multiple invalid fields in the room payload
	it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 422 when required fields are missing or invalid", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: "ORCH",
			number: 101,
			furniture: 12,
			seats: -1,
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.nested.property("body.error", "Validation failed");
		expect(res.body.fields).to.be.an("object");
		expect(Object.keys(res.body.fields)).to.not.be.empty;
	});

	// 422 — rejects fractional or non-finite seats values
	it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 422 when seats is fractional or non-finite", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const fractional = await request(app)
			.put("/api/v2/buildings/DMP/rooms/DMP_101")
			.send(makeRoom({ seats: 40.5 }));
		expect(fractional).to.have.property("status", 422);
		expect(fractional).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				seats: "expected a number >= 0",
			},
		});

		const nonFinite = await request(app)
			.put("/api/v2/buildings/DMP/rooms/DMP_101")
			.send(makeRoom({ seats: "many" }));
		expect(nonFinite).to.have.property("status", 422);
		expect(nonFinite).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				seats: "expected a number >= 0",
			},
		});
	});

	// 422 — rejects null required fields using the spec's required-but-missing messages
	it("PUT /api/v2/buildings/DMP/rooms/DMP_101 should return 422 when required fields are null", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
			building: null,
			number: null,
			type: null,
			furniture: null,
			href: null,
			seats: null,
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.nested.property("body.error", "Validation failed");
		expect(res.body.fields).to.be.an("object");
		expect(Object.keys(res.body.fields)).to.not.be.empty;
	});

	// ============================================================
	// GET /api/v2/buildings/{building}/rooms (200, 400, 404)
	// Retrieve a list of rooms for a building
	// ============================================================

	// 200 — returns paginated room list for a building
	it("GET /api/v2/buildings/DMP/rooms?limit=100&offset=0 should return 200 with a room list", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());
		await request(app)
			.put("/api/v2/buildings/DMP/rooms/DMP_201")
			.send(
				makeRoom({
					number: "201",
					type: "Small Group",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-201",
					seats: 25,
				})
			);

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?limit=100&offset=0");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
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

	// 400 — rejects invalid limit below allowed range
	it("GET /api/v2/buildings/DMP/rooms?limit=0&offset=0 should return 400 for an invalid limit", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?limit=0&offset=0");
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: { limit: "expected an integer between 1 and 5000" },
		});
	});

	// 400 — rejects invalid limit above allowed range
	it("GET /api/v2/buildings/DMP/rooms?limit=5001&offset=0 should return 400 for an invalid limit", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?limit=5001&offset=0");
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: { limit: "expected an integer between 1 and 5000" },
		});
	});

	// 400 — rejects negative offset
	it("GET /api/v2/buildings/DMP/rooms?limit=100&offset=-1 should return 400 for an invalid offset", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?limit=100&offset=-1");
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: { offset: "expected an integer >= 0" },
		});
	});

	// 404 — rejects listing rooms for a missing building
	it("GET /api/v2/buildings/DMP/rooms?limit=100&offset=0 should return 404 when the building does not exist", async () => {
		const res = await request(app).get("/api/v2/buildings/DMP/rooms?limit=100&offset=0");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	// 200 — applies default pagination when query params are omitted
	it("GET /api/v2/buildings/DMP/rooms should return 200 with default pagination", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());

		const res = await request(app).get("/api/v2/buildings/DMP/rooms");
		expect(res).to.have.property("status", 200);
		expect(res.body).to.have.property("total", 1);
		expect(res.body).to.have.property("limit", 100);
		expect(res.body).to.have.property("offset", 0);
		expect(res.body.items).to.be.an("array").with.length(1);
	});

	it("GET /api/v2/buildings/DMP/rooms?limit=100&offset=0 should include created room ids", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await request(app)
			.put("/api/v2/buildings/DMP/rooms/DMP_z")
			.send(
				makeRoom({
					number: "999",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-999",
				})
			);
		await request(app)
			.put("/api/v2/buildings/DMP/rooms/DMP_a")
			.send(
				makeRoom({
					number: "001",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-001",
				})
			);

		const res = await request(app).get("/api/v2/buildings/DMP/rooms?limit=100&offset=0");
		expect(res).to.have.property("status", 200);
		expect(res.body.items.map((item: any) => item.id)).to.have.members(["DMP_a", "DMP_z"]);
	});

	// ============================================================
	// GET /api/v2/buildings/{building}/rooms/{room} (200, 404)
	// Retrieve a room for a building
	// ============================================================

	// 200 — returns room resource with links
	it("GET /api/v2/buildings/DMP/rooms/DMP_101 should return 200 with the room resource", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());

		const res = await request(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
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

	// 404 — rejects when building does not exist
	it("GET /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the building does not exist", async () => {
		const res = await request(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	// 404 — rejects when room does not exist under existing building
	it("GET /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the room does not exist", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no room with id 'DMP_101'",
		});
	});

	// ============================================================
	// DELETE /api/v2/buildings/{building}/rooms/{room} (200, 404)
	// Remove a room from a building
	// ============================================================

	// 200 — deletes room and returns deleted room data
	it("DELETE /api/v2/buildings/DMP/rooms/DMP_101 should return 200 with the deleted room", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());
		await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send(makeRoom());

		const res = await request(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
			id: "DMP_101",
			building: "DMP",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
	});

	// 404 — rejects deleting room when building does not exist
	it("DELETE /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the building does not exist", async () => {
		const res = await request(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no building with id 'DMP'",
		});
	});

	// 404 — rejects deleting room when room does not exist
	it("DELETE /api/v2/buildings/DMP/rooms/DMP_101 should return 404 when the room does not exist", async () => {
		await request(app).put("/api/v2/buildings/DMP").send(makeBuilding());

		const res = await request(app).delete("/api/v2/buildings/DMP/rooms/DMP_101");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no room with id 'DMP_101'",
		});
	});

	// ============================================================
	// POST /api/v1/search (200, 400, 413, 422)
	// Search resources
	// ============================================================

	// 200 — returns results for a simple IS filter
	it("POST /api/v1/search should return 200 with query results for a simple IS filter", async () => {
		await uploadDatasetAndWait([
			{
				path: "courses/one.json",
				content: {
					result: [makeOffering()],
				},
			},
		]);

		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { IS: { dept: "cpsc" } },
					OPTIONS: { COLUMNS: ["dept", "avg"], ORDER: "avg" },
				},
			});

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [{ dept: "cpsc", avg: 76.4 }]);
	});

	// 200 — supports exact/prefix/suffix/contains wildcard forms in IS
	it("POST /api/v1/search should support valid wildcard forms in IS comparisons", async () => {
		await seedSearchDataset();

		const exactRes = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { IS: { dept: "cpsc" } },
					OPTIONS: { COLUMNS: ["code"], ORDER: "code" },
				},
			});
		expect(exactRes).to.have.property("status", 200);
		expect(exactRes).to.have.deep.property("body", [{ code: "210" }, { code: "310" }]);

		const startsWithRes = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { IS: { dept: "cp*" } },
					OPTIONS: { COLUMNS: ["code"], ORDER: "code" },
				},
			});
		expect(startsWithRes).to.have.property("status", 200);
		expect(startsWithRes).to.have.deep.property("body", [{ code: "210" }, { code: "310" }]);

		const endsWithRes = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { IS: { dept: "*th" } },
					OPTIONS: { COLUMNS: ["dept", "code"] },
				},
			});
		expect(endsWithRes).to.have.property("status", 200);
		expect(endsWithRes.body).to.deep.include({ dept: "math", code: "200" });

		const containsRes = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { IS: { dept: "*ps*" } },
					OPTIONS: { COLUMNS: ["code"], ORDER: "code" },
				},
			});
		expect(containsRes).to.have.property("status", 200);
		expect(containsRes).to.have.deep.property("body", [{ code: "210" }, { code: "310" }]);
	});

	// 200 — supports numeric comparisons and AND/OR/NOT logic filters
	it("POST /api/v1/search should support GT/LT/EQ and logical filters AND/OR/NOT", async () => {
		await seedSearchDataset();

		const andRes = await request(app)
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
		expect(andRes).to.have.property("status", 200);
		expect(andRes).to.have.deep.property("body", [{ code: "210", avg: 85 }]);

		const orRes = await request(app)
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
		expect(orRes).to.have.property("status", 200);
		expect(orRes).to.have.deep.property("body", [
			{ dept: "cpsc", avg: 76.4 },
			{ dept: "math", avg: 90 },
		]);

		const notRes = await request(app)
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
		expect(notRes).to.have.property("status", 200);
		expect(notRes.body).to.be.an("array").with.length(1);
		expect(notRes.body[0]).to.deep.equal({ dept: "math", code: "200" });

		const ltRes = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { LT: { avg: 80 } },
					OPTIONS: { COLUMNS: ["code"], ORDER: "code" },
				},
			});
		expect(ltRes).to.have.property("status", 200);
		expect(ltRes).to.have.deep.property("body", [{ code: "310" }]);
	});

	// 200 — allows WHERE:{} and omitted ORDER
	it("POST /api/v1/search should allow WHERE:{} to match all records and ORDER to be omitted", async () => {
		await seedSearchDataset();

		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept"] },
				},
			});

		expect(res).to.have.property("status", 200);
		expect(res.body).to.be.an("array").with.length(3);
		for (const row of res.body) {
			expect(row).to.have.all.keys(["dept"]);
		}
	});

	// 200 — returns exactly 5000 rows when query matches the result limit
	it("POST /api/v1/search should return 200 when query matches exactly 5000 results", async () => {
		const rows = Array.from({ length: 5000 }, (_, i) =>
			makeOffering({
				id: i + 1,
				Subject: "cpsc",
				Course: "310",
				Section: `${i}`,
			})
		);

		await uploadDatasetAndWait([
			{
				path: "courses/exact5000.json",
				content: { result: rows },
			},
		]);

		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept"] },
				},
			});

		expect(res).to.have.property("status", 200);
		expect(res.body).to.be.an("array").with.length(5000);
	});

	// 400 — rejects query missing WHERE
	it("POST /api/v1/search should return 400 when query is missing WHERE", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: { OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing WHERE",
		});
	});

	// 400 — rejects query missing OPTIONS
	it("POST /api/v1/search should return 400 when query is missing OPTIONS", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {} },
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing OPTIONS",
		});
	});

	// 400 — rejects OPTIONS missing COLUMNS
	it("POST /api/v1/search should return 400 when OPTIONS is missing COLUMNS", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: {} },
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing COLUMNS",
		});
	});

	// 400 — rejects ORDER key not present in COLUMNS
	it("POST /api/v1/search should return 400 when ORDER is not present in COLUMNS", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept"], ORDER: "avg" },
				},
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "ORDER must be a key in COLUMNS",
		});
	});

	// 400 — rejects unknown key in COLUMNS
	it("POST /api/v1/search should return 400 when COLUMNS contains an unknown key", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept", "gpa"] } },
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Unknown key in COLUMNS",
		});
	});

	// 400 — rejects WHERE that is not an object
	it("POST /api/v1/search should return 400 when WHERE is not an object", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: [], OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects WHERE objects with more than one FILTER key
	it("POST /api/v1/search should return 400 when WHERE contains more than one FILTER", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { GT: { avg: 70 }, LT: { avg: 90 } },
					OPTIONS: { COLUMNS: ["avg"] },
				},
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects OPTIONS that is not an object
	it("POST /api/v1/search should return 400 when OPTIONS is not an object", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: [] },
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects IS wildcards placed in the middle of a string
	it("POST /api/v1/search should return 400 when IS wildcard asterisks appear in the middle of the string", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: { WHERE: { IS: { dept: "c*sc" } }, OPTIONS: { COLUMNS: ["dept"] } },
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "IS asterisks can only be first or last character",
		});
	});

	// 400 — rejects empty AND arrays
	it("POST /api/v1/search should return 400 when AND is an empty array", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { AND: [] },
					OPTIONS: { COLUMNS: ["dept"] },
				},
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "AND must be a non-empty array of FILTER objects",
		});
	});

	// 400 — rejects malformed GT comparison
	it("POST /api/v1/search should return 400 when GT is malformed", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { GT: { avg: "99" } },
					OPTIONS: { COLUMNS: ["avg"] },
				},
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "GT must be an object with one mfield of type number",
		});
	});

	// 400 — rejects NOT values that are not FILTER objects
	it("POST /api/v1/search should return 400 when NOT is not a FILTER object", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { NOT: [] },
					OPTIONS: { COLUMNS: ["dept"] },
				},
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects malformed IS comparison
	it("POST /api/v1/search should return 400 when IS is malformed", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { IS: { dept: 123 } },
					OPTIONS: { COLUMNS: ["dept"] },
				},
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "IS must be an object with one sfield of type string",
		});
	});

	// 422 — rejects missing kind in request body
	it("POST /api/v1/search should return 422 when kind is missing", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["dept"] },
				},
			});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { kind: "required but missing" },
		});
	});

	// 422 — rejects missing query in request body
	it("POST /api/v1/search should return 422 when query is missing", async () => {
		const res = await request(app).post("/api/v1/search").send({ kind: "course_offerings" });

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { query: "required but missing" },
		});
	});

	// 422 — reports both kind and query errors when both are invalid
	it("POST /api/v1/search should return 422 with both kind and query errors when both are invalid", async () => {
		const res = await request(app).post("/api/v1/search").send({
			kind: "wrong",
			query: [],
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.nested.property("body.error", "Validation failed");
		expect(res.body.fields).to.be.an("object");
		expect(Object.keys(res.body.fields)).to.not.be.empty;
	});

	// ============================================================
	// POST /api/v2/search (200, 400, 413, 422)
	// Search resources with the v2 query language
	// ============================================================

	// 200 — supports facilities queries over room fields
	it("POST /api/v2/search should return facilities query results", async () => {
		await seedFacilitiesDataset();

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: { GT: { seats: 30 } },
					OPTIONS: { COLUMNS: ["building", "number", "seats"], ORDER: "seats" },
				},
			});

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [
			{ building: "DMP", number: "101", seats: 40 },
			{ building: "ORCH", number: "300", seats: 120 },
		]);
	});

	// 200 — supports TRANSFORMATIONS with aggregation over course offerings
	it("POST /api/v2/search should support TRANSFORMATIONS with GROUP and APPLY", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [
			{ dept: "math", maxAvg: 90 },
			{ dept: "cpsc", maxAvg: 85 },
		]);
	});

	// 200 — supports object ORDER with dir/keys for stable multi-key sorting
	it("POST /api/v2/search should support ORDER objects with direction and multiple keys", async () => {
		await seedFacilitiesDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [
			{ building: "ORCH", number: "300", seats: 120 },
			{ building: "DMP", number: "101", seats: 40 },
			{ building: "DMP", number: "201", seats: 25 },
		]);
	});

	// 200 — AVG and SUM round to 2 decimals and COUNT counts unique values within each group
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

		const res = await request(app)
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

		expect(res).to.have.property("status", 200);
		expect(res.body).to.be.an("array").with.length(1);
		expect(res.body[0]).to.include({ dept: "cpsc", uniqueInstructors: 2 });
		expect(res.body[0].avgRounded).to.be.a("number");
		expect(res.body[0].sumAvg).to.be.a("number");
	});

	// 200 — string ORDER comparisons use plain < / > semantics, not localeCompare()
	it("POST /api/v2/search should sort string ORDER keys using JavaScript relational comparisons", async () => {
		await request(app).put("/api/v2/buildings/SORT").send({
			name: "Sort Building",
			address: "123 Sort Street",
			lat: 49.2,
			lon: -123.1,
		});
		await request(app).put("/api/v2/buildings/SORT/rooms/SORT_Z1").send({
			building: "SORT",
			number: "Z1",
			type: "Lab",
			furniture: "Tables",
			href: "http://example.com/Z1",
			seats: 10,
		});
		await request(app).put("/api/v2/buildings/SORT/rooms/SORT_a1").send({
			building: "SORT",
			number: "a1",
			type: "Lab",
			furniture: "Tables",
			href: "http://example.com/a1",
			seats: 10,
		});

		const res = await request(app)
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

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [{ number: "Z1" }, { number: "a1" }]);
	});

	// 400 — rejects queries that mix course_offerings and facilities fields
	it("POST /api/v2/search should return 400 when a query mixes course_offerings and facilities fields", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { GT: { seats: 30 } },
					OPTIONS: { COLUMNS: ["dept", "seats"] },
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects invalid ORDER directions in v2 sort objects
	it("POST /api/v2/search should return 400 when ORDER dir is invalid", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Invalid sort direction (must be UP or DOWN)",
		});
	});

	// 400 — rejects TRANSFORMATIONS blocks without GROUP
	it("POST /api/v2/search should return 400 when TRANSFORMATIONS is missing GROUP", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects TRANSFORMATIONS blocks without APPLY
	it("POST /api/v2/search should return 400 when TRANSFORMATIONS is missing APPLY", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing APPLY in TRANSFORMATIONS",
		});
	});

	// 400 — rejects empty GROUP arrays in TRANSFORMATIONS
	it("POST /api/v2/search should return 400 when GROUP is an empty array", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects non-array APPLY blocks
	it("POST /api/v2/search should return 400 when APPLY is not an array", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects non-mfield aggregations for AVG/SUM/MAX/MIN
	it("POST /api/v2/search should return 400 when AVG is applied to an sfield", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "MAX/MIN/AVG/SUM can only be applied to mfields",
		});
	});

	// 400 — rejects invalid aggregation tokens
	it("POST /api/v2/search should return 400 when APPLY uses an invalid token", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Invalid APPLYTOKEN (must be MAX, MIN, AVG, COUNT, or SUM)",
		});
	});

	// 400 — rejects malformed APPLYRULE bodies that do not target a valid key
	it("POST /api/v2/search should return 400 when APPLYRULE does not apply to a valid key", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 400 — rejects duplicate apply keys inside APPLY
	it("POST /api/v2/search should return 400 when APPLY contains duplicate applykeys", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Duplicate applykey in APPLY",
		});
	});

	// 400 — rejects applykeys that are empty or contain underscores
	it("POST /api/v2/search should return 400 when applykey contains an underscore", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "applykey cannot be empty or contain underscore",
		});
	});

	// 400 — rejects COLUMNS entries that are not in GROUP or APPLY when TRANSFORMATIONS is present
	it("POST /api/v2/search should return 400 when COLUMNS contains a key outside GROUP and APPLY", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY",
		});
	});

	// 400 — rejects kind-invalid keys in COLUMNS with the direct COLUMNS error
	it("POST /api/v2/search should return 400 when COLUMNS uses a facilities key for course_offerings", async () => {
		await seedSearchDataset();

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: { COLUMNS: ["seats"] },
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Cannot mix course_offerings and facilities fields in one query",
		});
	});

	// 400 — rejects mixed kinds when TRANSFORMATIONS references facilities fields in a course query
	it("POST /api/v2/search should return 400 when TRANSFORMATIONS mixes course_offerings and facilities fields", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Cannot mix course_offerings and facilities fields in one query",
		});
	});

	// 400 — rejects wrong-kind keys referenced only in ORDER
	it("POST /api/v2/search should return 400 when ORDER uses a facilities key for course_offerings", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.nested.property("body.error", "Invalid query");
	});

	// 413 — evaluates the result cap after TRANSFORMATIONS, so grouped results may be <= 5000
	it("POST /api/v2/search should not return 413 when more than 5000 rows collapse below the cap after grouping", async () => {
		const offerings = Array.from({ length: 5001 }, (_, index) =>
			makeOffering({
				id: 50000 + index,
				Course: `${100 + index}`,
				Subject: "cpsc",
				Professor: `prof-${index}`,
				Avg: index % 100,
				Pass: index,
			})
		);
		await seedOfferings(offerings);

		const res = await request(app)
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

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [{ dept: "cpsc", countCourses: 5001 }]);
	});

	// 422 — accepts both supported v2 kinds and rejects invalid ones
	it("POST /api/v2/search should return 422 when kind is invalid for v2", async () => {
		const res = await request(app).post("/api/v2/search").send({
			kind: "wrong",
			query: {},
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { kind: "expected to be course_offerings or facilities" },
		});
	});

	// 422 — rejects non-object query bodies with the v2 request validation contract
	it("POST /api/v2/search should return 422 when query is not an object", async () => {
		const res = await request(app).post("/api/v2/search").send({
			kind: "facilities",
			query: [],
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { query: "expected an object" },
		});
	});

	// 200 — GROUP with empty APPLY is valid and returns one row per group
	it("POST /api/v2/search should allow TRANSFORMATIONS with GROUP and an empty APPLY array", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [{ dept: "cpsc" }, { dept: "math" }]);
	});

	// 200 — COUNT may be applied to an sfield for facilities
	it("POST /api/v2/search should allow COUNT over a facilities sfield", async () => {
		await seedFacilitiesDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [
			{ building: "DMP", uniqueTypes: 2 },
			{ building: "ORCH", uniqueTypes: 1 },
		]);
	});

	// 200 — AVG and SUM should use ordinary two-decimal rounding
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

		const res = await request(app)
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

		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", [
			{
				dept: "cpsc",
				avgRounded: 0.01,
				sumAvg: 0.04,
				uniqueInstructors: 2,
			},
		]);
	});

	// 400 — ORDER object keys must all appear in COLUMNS
	it("POST /api/v2/search should return 400 when an ORDER object key is not in COLUMNS", async () => {
		await seedFacilitiesDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "All ORDER keys must be in COLUMNS",
		});
	});

	// 400 — ORDER object must not have an empty keys array
	it("POST /api/v2/search should return 400 when ORDER keys is an empty array", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "All ORDER keys must be in COLUMNS",
		});
	});

	// 400 — ORDER object keys must all be strings
	it("POST /api/v2/search should return 400 when ORDER keys contains a non-string value", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "All ORDER keys must be in COLUMNS",
		});
	});

	// 400 — ORDER must be either a string key or a valid ORDER object
	it("POST /api/v2/search should return 400 when ORDER is neither a string nor an object", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "ORDER must be a key in COLUMNS",
		});
	});

	// 400 — v2 should reject non-object OPTIONS with the v2-specific message
	it("POST /api/v2/search should return 400 when OPTIONS is not an object", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: [],
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "OPTIONS must be an object with COLUMNS and optional ORDER",
		});
	});

	// 400 — malformed TRANSFORMATIONS container should surface Missing GROUP
	it("POST /api/v2/search should return 400 when TRANSFORMATIONS is not an object", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing GROUP in TRANSFORMATIONS",
		});
	});

	// 400 — APPLYRULE must have exactly one applykey
	it("POST /api/v2/search should return 400 when an APPLYRULE has multiple applykeys", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "APPLYRULE must apply aggregation to a valid KEY",
		});
	});

	// 400 — APPLY body must have exactly one token:key pair
	it("POST /api/v2/search should return 400 when an APPLYRULE body has multiple aggregation tokens", async () => {
		await seedSearchDataset();

		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "APPLYRULE must apply aggregation to a valid KEY",
		});
	});

	// 400 — v2 should still reject malformed WHERE with the exact spec message
	it("POST /api/v2/search should return 400 when WHERE contains more than one FILTER", async () => {
		const res = await request(app)
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

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "WHERE must be an object with at most one FILTER",
		});
	});

	// ============================================================
	// GET /api/v1/courses (200, 400)
	// Retrieve a list of courses
	// ============================================================

	// 200 — returns default pagination for empty course list
	it("GET /api/v1/courses should return 200 with default pagination on an empty course list", async () => {
		const res = await request(app).get("/api/v1/courses");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", { total: 0, limit: 100, offset: 0, items: [] });
	});

	// 200 — returns explicit pagination payload for empty course list
	it("GET /api/v1/courses?limit=100&offset=0 should return 200 with an empty course list", async () => {
		const res = await request(app).get("/api/v1/courses?limit=100&offset=0");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", { total: 0, limit: 100, offset: 0, items: [] });
	});

	// 200 — returns courses ordered by id ascending for stable pagination
	// 200 — paginates courses using limit/offset and allows empty page past end
	it("GET /api/v1/courses should paginate using limit and offset", async () => {
		await request(app).put("/api/v1/courses/cpsc110").send({
			title: "Computation, Programs, and Programming",
			dept: "Computer Science",
			code: "110",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software Construction",
			dept: "Computer Science",
			code: "210",
		});
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const pageRes = await request(app).get("/api/v1/courses?limit=1&offset=1");
		expect(pageRes).to.have.property("status", 200);
		expect(pageRes.body).to.have.property("total", 3);
		expect(pageRes.body).to.have.property("limit", 1);
		expect(pageRes.body).to.have.property("offset", 1);
		expect(pageRes.body.items).to.deep.equal([
			{
				id: "cpsc210",
				title: "Software Construction",
				dept: "Computer Science",
				code: "210",
				links: { self: "/api/v1/courses/cpsc210", sections: "/api/v1/courses/cpsc210/sections" },
			},
		]);

		const emptyPageRes = await request(app).get("/api/v1/courses?limit=10&offset=99");
		expect(emptyPageRes).to.have.property("status", 200);
		expect(emptyPageRes.body).to.have.property("total", 3);
		expect(emptyPageRes.body.items).to.deep.equal([]);
	});

	it("GET /api/v1/courses should include created course ids in paginated results", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software Construction",
			dept: "Computer Science",
			code: "210",
		});

		const res = await request(app).get("/api/v1/courses?limit=100&offset=0");
		expect(res).to.have.property("status", 200);
		expect(res.body).to.have.property("total", 2);
		expect(res.body.items.map((item: any) => item.id)).to.have.members(["cpsc210", "cpsc310"]);
	});

	// 400 — rejects invalid limit below allowed range
	it("GET /api/v1/courses?limit=0&offset=0 should return 400 for an invalid limit", async () => {
		const res = await request(app).get("/api/v1/courses?limit=0&offset=0");
		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	// 400 — rejects invalid negative offset
	it("GET /api/v1/courses?limit=100&offset=-1 should return 400 for an invalid offset", async () => {
		const res = await request(app).get("/api/v1/courses?limit=100&offset=-1");
		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	it("GET /api/v1/courses should return 400 when both limit and offset are invalid", async () => {
		const res = await request(app).get("/api/v1/courses?limit=0&offset=-1");
		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	// 400 — rejects invalid non-integer limit (e.g., 1.5)
	it("GET /api/v1/courses should return 400 when limit is not an integer (e.g., 1.5)", async () => {
		const res = await request(app).get("/api/v1/courses?limit=1.5&offset=0");
		expect(res).to.have.property("status", 400);
		expect(res.body.params).to.have.property("limit");
	});

	// ============================================================
	// GET /api/v1/courses/{course} (200, 404)
	// Retrieve a course
	// ============================================================

	// 200 — returns course resource with links
	it("GET /api/v1/courses/cpsc310 should return 200 with the course resource", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			links: { self: "/api/v1/courses/cpsc310", sections: "/api/v1/courses/cpsc310/sections" },
		});
	});

	// 404 — rejects missing course id
	it("GET /api/v1/courses/cpsc999 should return 404 when the course does not exist", async () => {
		const res = await request(app).get("/api/v1/courses/cpsc999");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc999'",
		});
	});

	// ============================================================
	// PUT /api/v1/courses/{course} (201, 204, 422)
	// Create or replace a course
	// ============================================================

	// 201 — creates course and returns created resource
	it("PUT /api/v1/courses/cpsc310 should return 201 with the created course resource", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		expect(res).to.have.property("status", 201);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			links: { self: "/api/v1/courses/cpsc310", sections: "/api/v1/courses/cpsc310/sections" },
		});
	});

	// 204 — updates existing course and returns no content (preserves sections)
	it("PUT /api/v1/courses/cpsc310 should return 204 and preserve existing sections when updating a course", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Old Title",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: "New Title",
			dept: "Computer Science",
			code: "310",
		});

		expect(res).to.have.property("status", 204);
		expect(res.text).to.equal("");

		const courseRes = await request(app).get("/api/v1/courses/cpsc310");
		expect(courseRes).to.have.property("status", 200);
		expect(courseRes).to.have.nested.property("body.title", "New Title");

		const secRes = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(secRes).to.have.property("status", 200);
		expect(secRes).to.have.nested.property("body.id", "21w201");
	});

	// 422 — rejects missing/invalid required fields in course payload
	it("PUT /api/v1/courses/cpsc310 should return 422 when required fields are missing or invalid types", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: null,
			dept: 123,
			// code missing
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.nested.property("body.error", "Validation failed");
		expect(res.body.fields).to.be.an("object");
		expect(Object.keys(res.body.fields)).to.not.be.empty;
	});

	// ============================================================
	// DELETE /api/v1/courses/{course} (200, 404)
	// Remove a course
	// ============================================================

	// 200 — deletes course and returns metadata plus deleted section count
	it("DELETE /api/v1/courses/cpsc310 should return 200 with deleted course metadata and section count", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w202").send({
			instructor: "bradley, nick",
			year: 2021,
			avg: 77.1,
			pass: 172,
			fail: 1,
			audit: 0,
		});

		const res = await request(app).delete("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", 200);
		expect(res.body).to.include({
			id: "cpsc310",
			title: "Introduction to Software Engineering",
		});
		expect(res.body).to.have.property("sections");
	});

	// 404 — rejects deleting missing course
	it("DELETE /api/v1/courses/cpsc310 should return 404 when the course does not exist", async () => {
		const res = await request(app).delete("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	// ============================================================
	// GET /api/v1/courses/{course}/sections (200, 400, 404)
	// Retrieve a list of sections for a course
	// ============================================================

	// 200 — returns paginated section list for a course
	it("GET /api/v1/courses/cpsc310/sections?limit=100&offset=0 should respond with status 200 and body = list of sections", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		}); // init the course
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		}); // init the sections
		await request(app).put("/api/v1/courses/cpsc310/sections/21w202").send({
			instructor: "bradley, nick",
			year: 2021,
			avg: 77.1,
			pass: 172,
			fail: 1,
			audit: 0,
		}); // init the sections
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=0"); // default behavoir test
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
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

	// 400 — rejects invalid limit below allowed range
	it("GET /api/v1/courses/cpsc310/sections?limit=0&offset=0 should respond with status 400 and validation error for limit", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=0&offset=0");
		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	// 400 — rejects invalid limit above allowed range
	it("GET /api/v1/courses/cpsc310/sections?limit=5001&offset=0 should respond with status 400 and validation error for limit", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=5001&offset=0");
		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	// 400 — rejects negative offset
	it("GET /api/v1/courses/cpsc310/sections?limit=100&offset=-1 should respond with status 400 and validation error for offset", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=-1");
		expect(res).to.have.property("status", 400);
		expect(res.body).to.have.property("error");
	});

	// 404 — rejects listing sections for a missing course
	it("GET /api/v1/courses/cpsc310/sections?limit=100&offset=0 should respond with status 404 when course does not exist", async () => {
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=0");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.nested.property("body.error", "Not found");
		expect(res).to.have.nested.property("body.message");
		expect(res.body.message).to.be.a("string").and.not.equal("");
	});

	// 200 — applies default pagination when query params are omitted
	it("GET /api/v1/courses/cpsc310/sections should respond with status 200 and default pagination", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections");
		expect(res).to.have.property("status", 200);
		expect(res.body).to.have.property("total", 1);
		expect(res.body).to.have.property("limit", 100);
		expect(res.body).to.have.property("offset", 0);
		expect(res.body.items).to.be.an("array").with.length(1);
	});

	it("GET /api/v1/courses/cpsc310/sections?limit=100&offset=0 should include created section ids", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/z-last").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/a-first").send({
			instructor: "bradley, nick",
			year: 2021,
			avg: 77.1,
			pass: 172,
			fail: 1,
			audit: 0,
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=100&offset=0");
		expect(res).to.have.property("status", 200);
		expect(res.body.items.map((item: any) => item.id)).to.have.members(["a-first", "z-last"]);
	});

	// ============================================================
	// GET /api/v1/courses/{course}/sections/{section} (200, 404)
	// Retrieve a section for a course
	// ============================================================

	// 200 — returns section resource with links
	it("GET /api/v1/courses/cpsc310/sections/21w201 should respond with status 200 and body = section", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
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

	// 404 — rejects when course does not exist
	it("GET /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when course does not exist", async () => {
		const res = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	// 404 — rejects when section does not exist under existing course
	it("GET /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when section does not exist", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no section with id '21w201'",
		});
	});

	// ============================================================
	// PUT /api/v1/courses/{course}/sections/{section} (201, 204, 404, 422)
	// Create or replace a section for a course
	// ============================================================

	// 201 — creates section and returns created resource
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 201 and body = created section", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		expect(res).to.have.property("status", 201);
		expect(res).to.have.deep.property("body", {
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

	// 204 — updates section and returns no content
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 204 and no body when updating section", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "skeens, paul",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		expect(res).to.have.property("status", 204);
		expect(res.text).to.equal("");
		const resDoubleCheck = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(resDoubleCheck).to.have.property("status", 200);
		expect(resDoubleCheck).to.have.deep.property("body", {
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

	// 404 — rejects creating/updating section under missing course
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when course does not exist", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	// 422 — rejects multiple validation failures in section payload
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 and body = validation error (missing instructor + invalid numbers)", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			year: 1899,
			avg: 300,
			pass: 167,
			fail: -3,
			audit: 1,
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				instructor: "required but missing",
				year: "expected a number between 1900 and 2099",
				avg: "expected a number between 0 and 100",
				fail: "expected a number >= 0",
			},
		});
	});

	// 422 — rejects invalid numeric bounds in section payload
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 and body = validation error (invalid numbers only)", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2100,
			avg: -1,
			pass: 167,
			fail: -3,
			audit: 1,
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				year: "expected a number between 1900 and 2099",
				avg: "expected a number between 0 and 100",
				fail: "expected a number >= 0",
			},
		});
	});

	// 422 — rejects non integer year
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 when year is fractional", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021.5,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				year: "expected a number between 1900 and 2099",
			},
		});
	});

	// 201 — accepts inclusive min bounds for numeric fields
	it("PUT /api/v1/courses/cpsc310/sections/minedge should respond with status 201 at inclusive lower bounds", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/minedge").send({
			instructor: "holmes, reid",
			year: 1900,
			avg: 0,
			pass: 0,
			fail: 0,
			audit: 0,
		});
		expect(res).to.have.property("status", 201);
		expect(res.body).to.have.property("year", 1900);
		expect(res.body).to.have.property("avg", 0);
		expect(res.body).to.have.property("pass", 0);
		expect(res.body).to.have.property("fail", 0);
		expect(res.body).to.have.property("audit", 0);
	});

	// 201 — accepts inclusive max bounds for year and avg
	it("PUT /api/v1/courses/cpsc310/sections/maxedge should respond with status 201 at inclusive upper bounds", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/maxedge").send({
			instructor: "holmes, reid",
			year: 2099,
			avg: 100,
			pass: 1,
			fail: 0,
			audit: 0,
		});
		expect(res).to.have.property("status", 201);
		expect(res.body).to.have.property("year", 2099);
		expect(res.body).to.have.property("avg", 100);
	});

	// 422 — rejects fractional section count fields
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 when pass/fail/audit are fractional", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167.2,
			fail: 3.1,
			audit: 1.7,
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				pass: "expected a number >= 0",
				fail: "expected a number >= 0",
				audit: "expected a number >= 0",
			},
		});
	});

	// 404 — missing course takes precedence over payload validation
	it("PUT /api/v1/courses/cpsc999/sections/21w201 should respond with status 404 even if body is invalid", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc999/sections/21w201").send({
			year: 1800,
			avg: -1,
			pass: -1,
			fail: -1,
			audit: -1,
		});
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc999'",
		});
	});

	// 422 — rejects missing required instructor in section payload
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 and body = validation error (missing instructor only)", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				instructor: "required but missing",
			},
		});
	});

	// 422 — rejects null required fields in section payload
	it("PUT /api/v1/courses/cpsc310/sections/21w201 should respond with status 422 when required fields are null", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: null,
			year: null,
			avg: null,
			pass: null,
			fail: null,
			audit: null,
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.nested.property("body.error", "Validation failed");
		expect(res.body.fields).to.be.an("object");
		expect(Object.keys(res.body.fields)).to.not.be.empty;
	});

	// TODO (PUT /api/v1/courses/{course}/sections/{section} 422): add tests for non-number types (e.g., year: "2021")
	// TODO (PUT /api/v1/courses/{course}/sections/{section} 422): add tests for missing required numeric fields (e.g., omit avg/pass/fail/audit)
	// TODO (PUT /api/v1/courses/{course}/sections/{section} 422): add tests for invalid instructor type (e.g., instructor: 123)

	// ============================================================
	// DELETE /api/v1/courses/{course}/sections/{section} (200, 404)
	// Remove a section from a course
	// ============================================================

	// 200 — deletes section and returns deleted section data
	it("DELETE /api/v1/courses/cpsc310/sections/21w201 should respond with status 200 and body = deleted section", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).delete("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
	});

	// 404 — rejects deleting section when course does not exist
	it("DELETE /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when course does not exist", async () => {
		const res = await request(app).delete("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	// 404 — rejects deleting section when section does not exist
	it("DELETE /api/v1/courses/cpsc310/sections/21w201 should respond with status 404 when section does not exist", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).delete("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no section with id '21w201'",
		});
	});
});
