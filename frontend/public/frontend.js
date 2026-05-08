// =========================
// DOM references
// =========================
// Dataset upload controls/status.
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("zip-upload");
const statusMsg = document.getElementById("status-message");
const resultContainer = document.getElementById("result-container");
const apiStatusOutput = document.getElementById("api-status-output");
const datasetKindSelect = document.getElementById("dataset-kind");

// Table filter controls + table surface.
const deptInput = document.getElementById("filter-dept");
const yearMinInput = document.getElementById("filter-year-min");
const yearMaxInput = document.getElementById("filter-year-max");
const instructorInput = document.getElementById("filter-instructor");
const applyFiltersBtn = document.getElementById("apply-filters-btn");
const clearFiltersBtn = document.getElementById("clear-filters-btn");
const tableStatus = document.getElementById("table-status");
const offeringsTbody = document.getElementById("offerings-tbody");
const offeringsTable = document.getElementById("offerings-table");

const insightsStatus = document.getElementById("insights-status");
const facilitiesBuildingSelect = document.getElementById("insight-building-filter");
const topNInput = document.getElementById("insight-top-n");
const topNValue = document.getElementById("insight-top-n-value");

const deptAvgChart = document.getElementById("dept-avg-chart");
const roomTypeChart = document.getElementById("room-type-chart");
const buildingCapacityChart = document.getElementById("building-capacity-chart");

// =========================
// Constants / state
// =========================
const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 120000;
const TABLE_COLUMNS = ["dept", "code", "title", "year", "instructor", "avg"];
let currentSort = "dept";

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("click-me-button").addEventListener("click", handleClickMe);
	uploadBtn.addEventListener("click", handleDatasetUpload);

	applyFiltersBtn.addEventListener("click", () => {
		void Promise.all([loadOfferings(), loadInsights()]);
	});

	clearFiltersBtn.addEventListener("click", () => {
		deptInput.value = "";
		yearMinInput.value = "";
		yearMaxInput.value = "";
		instructorInput.value = "";
		void Promise.all([loadOfferings(), loadInsights()]);
	});

	offeringsTable.querySelectorAll("th[data-sort]").forEach((th) => {
		th.addEventListener("click", () => {
			currentSort = th.dataset.sort;
			void loadOfferings();
		});
	});

	facilitiesBuildingSelect.addEventListener("change", () => {
		void loadInsights();
	});

	topNInput.addEventListener("input", () => {
		topNValue.textContent = topNInput.value;
		void loadInsights();
	});

	void initializeDashboard();
});

function setStatus(text, statusClass) {
	statusMsg.textContent = text;
	statusMsg.className = `status ${statusClass}`;
}

function renderError(message, hint = "") {
	resultContainer.innerHTML = `
		<h2>Upload Failed</h2>
		<p class="error-text">${message}</p>
		${hint ? `<p class="hint-text">${hint}</p>` : ""}
	`;
}

function renderUploadSuccess(data) {
	const stats = data.stats || {};

	if (data.kind === "facilities") {
		const allAddedOrModifiedZero =
			(stats.buildings_added ?? 0) === 0 &&
			(stats.buildings_modified ?? 0) === 0 &&
			(stats.rooms_added ?? 0) === 0 &&
			(stats.rooms_modified ?? 0) === 0;

		resultContainer.innerHTML = `
			<h2>Upload Complete</h2>
			<p class="success-text">${data.message || "Dataset processing complete"}</p>
			<ul class="stats-list">
				<li>Buildings added: <strong>${stats.buildings_added ?? 0}</strong></li>
				<li>Buildings modified: <strong>${stats.buildings_modified ?? 0}</strong></li>
				<li>Rooms added: <strong>${stats.rooms_added ?? 0}</strong></li>
				<li>Rooms modified: <strong>${stats.rooms_modified ?? 0}</strong></li>
			</ul>
			${
				allAddedOrModifiedZero
					? '<p class="hint-text">No resources were added or modified. This can happen when data already exists or records were skipped by backend validation.</p>'
					: ""
			}
		`;
		return;
	}

	const allAddedOrModifiedZero =
		(stats.courses_added ?? 0) === 0 &&
		(stats.courses_modified ?? 0) === 0 &&
		(stats.sections_added ?? 0) === 0 &&
		(stats.sections_modified ?? 0) === 0;

	resultContainer.innerHTML = `
		<h2>Upload Complete</h2>
		<p class="success-text">${data.message || "Dataset processing complete"}</p>
		<ul class="stats-list">
			<li>Courses added: <strong>${stats.courses_added ?? 0}</strong></li>
			<li>Courses modified: <strong>${stats.courses_modified ?? 0}</strong></li>
			<li>Sections added: <strong>${stats.sections_added ?? 0}</strong></li>
			<li>Sections modified: <strong>${stats.sections_modified ?? 0}</strong></li>
			<li>Files processed: <strong>${stats.files_processed ?? 0}</strong> / ${stats.files_total ?? 0}</li>
			<li>Courses seen: <strong>${stats.courses_seen ?? 0}</strong></li>
			<li>Sections seen: <strong>${stats.sections_seen ?? 0}</strong></li>
		</ul>
		${
			allAddedOrModifiedZero
				? '<p class="hint-text">No resources were added or modified. This can happen when data already exists or records were skipped by backend validation.</p>'
				: ""
		}
	`;
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function setTableStatus(text) {
	tableStatus.textContent = text;
}

function deptFilters() {
	return deptInput.value
		.split(",")
		.map((d) => d.trim())
		.filter((d) => d.length > 0);
}

function buildFilterQuery() {
	const filters = [];
	const depts = deptFilters();

	if (depts.length === 1) {
		filters.push({ IS: { dept: depts[0] } });
	} else if (depts.length > 1) {
		filters.push({ OR: depts.map((d) => ({ IS: { dept: d } })) });
	}

	const yearMin = Number.parseInt(yearMinInput.value, 10);
	if (Number.isInteger(yearMin)) {
		filters.push({ GT: { year: yearMin - 1 } });
	}

	const yearMax = Number.parseInt(yearMaxInput.value, 10);
	if (Number.isInteger(yearMax)) {
		filters.push({ LT: { year: yearMax + 1 } });
	}

	const instructorTerm = instructorInput.value.trim().replace(/\*/g, "");
	if (instructorTerm) {
		filters.push({ IS: { instructor: `*${instructorTerm}*` } });
	}

	if (filters.length === 0) {
		return {};
	}
	if (filters.length === 1) {
		return filters[0];
	}
	return { AND: filters };
}

async function queryOfferings() {
	const res = await fetch("/api/v1/search", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			kind: "course_offerings",
			query: {
				WHERE: buildFilterQuery(),
				OPTIONS: {
					COLUMNS: TABLE_COLUMNS,
					ORDER: currentSort,
				},
			},
		}),
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message || body.error || `Search failed (${res.status})`);
	}
	return res.json();
}

function renderOfferingsTable(rows) {
	offeringsTbody.innerHTML = rows
		.map(
			(r) => `
			<tr>
				<td>${r.dept ?? ""}</td>
				<td>${r.code ?? ""}</td>
				<td>${r.title ?? ""}</td>
				<td>${r.year ?? ""}</td>
				<td>${r.instructor ?? ""}</td>
				<td>${r.avg ?? ""}</td>
			</tr>
		`
		)
		.join("");
}

async function loadOfferings() {
	setTableStatus("Loading results...");
	try {
		const rows = await queryOfferings();
		renderOfferingsTable(rows);
		setTableStatus(`Showing ${rows.length} result(s), sorted by ${currentSort}.`);
	} catch (err) {
		offeringsTbody.innerHTML = "";
		setTableStatus(`Unable to load offerings: ${err.message}`);
	}
}

function setInsightsStatus(text) {
	insightsStatus.textContent = text;
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (char) => {
		const map = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		};
		return map[char];
	});
}

function truncateLabel(value, max = 14) {
	const s = String(value);
	return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function renderEmptySvg(svg, message) {
	svg.innerHTML = `
		<rect x="0" y="0" width="640" height="240" fill="#ffffff"></rect>
		<text x="20" y="40" fill="#475569">${escapeHtml(message)}</text>
	`;
}

async function apiJson(url, options = {}) {
	const res = await fetch(url, options);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message || body.error || `Request failed (${res.status})`);
	}
	return res.json();
}

async function putJson(url, body) {
	const res = await fetch(url, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok && res.status !== 204 && res.status !== 201) {
		const payload = await res.json().catch(() => ({}));
		throw new Error(payload.message || payload.error || `PUT failed (${res.status})`);
	}
}

async function initializeDashboard() {
	topNValue.textContent = topNInput.value;
	await ensureDemoData();
	await populateBuildingOptions();
	await Promise.all([loadOfferings(), loadInsights()]);
}

async function ensureDemoData() {
	const [coursesRes, buildingsRes] = await Promise.all([
		apiJson("/api/v1/courses?limit=1&offset=0"),
		apiJson("/api/v2/buildings?limit=1&offset=0"),
	]);

	if (coursesRes.total === 0) {
		await seedDemoCourses();
	}

	if (buildingsRes.total === 0) {
		await seedDemoFacilities();
	}
}

async function seedDemoCourses() {
	const courses = [
		{
			id: "cpsc110",
			title: "Computation, Programs, and Programming",
			dept: "cpsc",
			code: "110",
			sections: [
				{ id: "110-2021w1", instructor: "Gregor", year: 2021, avg: 81.4, pass: 200, fail: 5, audit: 2 },
				{ id: "110-2022w1", instructor: "Reid", year: 2022, avg: 84.1, pass: 210, fail: 6, audit: 1 },
			],
		},
		{
			id: "cpsc210",
			title: "Software Construction",
			dept: "cpsc",
			code: "210",
			sections: [
				{ id: "210-2021w1", instructor: "Doug", year: 2021, avg: 79.6, pass: 180, fail: 8, audit: 0 },
				{ id: "210-2022w1", instructor: "Gregor", year: 2022, avg: 82.0, pass: 185, fail: 7, audit: 1 },
			],
		},
		{
			id: "math200",
			title: "Calculus III",
			dept: "math",
			code: "200",
			sections: [
				{ id: "200-2021w1", instructor: "Taylor", year: 2021, avg: 73.8, pass: 160, fail: 12, audit: 0 },
				{ id: "200-2022w1", instructor: "Ng", year: 2022, avg: 76.3, pass: 170, fail: 10, audit: 1 },
			],
		},
		{
			id: "econ101",
			title: "Principles of Microeconomics",
			dept: "econ",
			code: "101",
			sections: [
				{ id: "101-2021w1", instructor: "Chan", year: 2021, avg: 77.5, pass: 220, fail: 9, audit: 1 },
				{ id: "101-2022w1", instructor: "Lee", year: 2022, avg: 80.9, pass: 230, fail: 7, audit: 0 },
			],
		},
		{
			id: "biol200",
			title: "Fundamentals of Cell Biology",
			dept: "biol",
			code: "200",
			sections: [
				{ id: "biol200-2021w1", instructor: "Singh", year: 2021, avg: 74.9, pass: 190, fail: 14, audit: 2 },
				{ id: "biol200-2022w1", instructor: "Patel", year: 2022, avg: 78.2, pass: 205, fail: 11, audit: 1 },
			],
		},
	];

	for (const course of courses) {
		await putJson(`/api/v1/courses/${course.id}`, {
			title: course.title,
			dept: course.dept,
			code: course.code,
		});

		for (const section of course.sections) {
			await putJson(`/api/v1/courses/${course.id}/sections/${section.id}`, section);
		}
	}
}

async function seedDemoFacilities() {
	const buildings = [
		{
			id: "DMP",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			rooms: [
				{
					id: "DMP_101",
					building: "DMP",
					number: "101",
					type: "Open Design General Purpose",
					furniture: "Classroom-Movable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
					seats: 40,
				},
				{
					id: "DMP_201",
					building: "DMP",
					number: "201",
					type: "Small Group",
					furniture: "Tables and Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-201",
					seats: 24,
				},
			],
		},
		{
			id: "ORCH",
			name: "Orchard Commons",
			address: "6363 Agronomy Road",
			lat: 49.26048,
			lon: -123.25027,
			rooms: [
				{
					id: "ORCH_300",
					building: "ORCH",
					number: "300",
					type: "Tiered Large Group",
					furniture: "Fixed Tables/Fixed Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ORCH-300",
					seats: 120,
				},
				{
					id: "ORCH_310",
					building: "ORCH",
					number: "310",
					type: "Open Design General Purpose",
					furniture: "Movable Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ORCH-310",
					seats: 64,
				},
				{
					id: "ORCH_320",
					building: "ORCH",
					number: "320",
					type: "Seminar",
					furniture: "Movable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ORCH-320",
					seats: 28,
				},
			],
		},
		{
			id: "HEBB",
			name: "Hebb Building",
			address: "2045 East Mall",
			lat: 49.26674,
			lon: -123.25099,
			rooms: [
				{
					id: "HEBB_100",
					building: "HEBB",
					number: "100",
					type: "Tiered Large Group",
					furniture: "Fixed Tables/Fixed Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/HEBB-100",
					seats: 375,
				},
				{
					id: "HEBB_120",
					building: "HEBB",
					number: "120",
					type: "Laboratory",
					furniture: "Lab Benches/Stools",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/HEBB-120",
					seats: 36,
				},
				{
					id: "HEBB_140",
					building: "HEBB",
					number: "140",
					type: "Classroom",
					furniture: "Tablet Arm Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/HEBB-140",
					seats: 80,
				},
				{
					id: "HEBB_150",
					building: "HEBB",
					number: "150",
					type: "Open Design General Purpose",
					furniture: "Movable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/HEBB-150",
					seats: 54,
				},
			],
		},
		{
			id: "BUCH",
			name: "Buchanan Building",
			address: "1866 Main Mall",
			lat: 49.26902,
			lon: -123.25478,
			rooms: [
				{
					id: "BUCH_A101",
					building: "BUCH",
					number: "A101",
					type: "Lecture Hall",
					furniture: "Fixed Tablet Arm Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/BUCH-A101",
					seats: 180,
				},
			],
		},
		{
			id: "ANGU",
			name: "Angus Building",
			address: "2053 Main Mall",
			lat: 49.26486,
			lon: -123.25302,
			rooms: [
				{
					id: "ANGU_098",
					building: "ANGU",
					number: "098",
					type: "Computer Lab",
					furniture: "Computers and Fixed Desks",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ANGU-098",
					seats: 45,
				},
				{
					id: "ANGU_192",
					building: "ANGU",
					number: "192",
					type: "Classroom",
					furniture: "Movable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ANGU-192",
					seats: 60,
				},
				{
					id: "ANGU_293",
					building: "ANGU",
					number: "293",
					type: "Seminar",
					furniture: "Boardroom Table and Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ANGU-293",
					seats: 22,
				},
				{
					id: "ANGU_295",
					building: "ANGU",
					number: "295",
					type: "Seminar",
					furniture: "Movable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ANGU-295",
					seats: 18,
				},
				{
					id: "ANGU_299",
					building: "ANGU",
					number: "299",
					type: "Lecture Hall",
					furniture: "Fixed Tablet Arm Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ANGU-299",
					seats: 110,
				},
			],
		},
		{
            id: "ICCS",
            name: "ICICS/CS Building",
            address: "2012 Main Mall",
            lat: 49.26117,
            lon: -123.24894,
            rooms: [
                {
                    id: "ICCS_X150",
                    building: "ICCS",
                    number: "X150",
                    type: "Lecture Hall",
                    furniture: "Fixed Tablet Arm Chairs",
                    href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ICCS-X150",
                    seats: 135,
                },
                {
                    id: "ICCS_X160",
                    building: "ICCS",
                    number: "X160",
                    type: "Computer Lab",
                    furniture: "Computers and Fixed Desks",
                    href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ICCS-X160",
                    seats: 55,
                },
                {
                    id: "ICCS_X170",
                    building: "ICCS",
                    number: "X170",
                    type: "Small Group",
                    furniture: "Tables and Chairs",
                    href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/ICCS-X170",
                    seats: 20,
                },
            ],
        },
		{
			id: "LSC",
			name: "Life Sciences Centre",
			address: "2350 Health Sciences Mall",
			lat: 49.26258,
			lon: -123.24577,
			rooms: [
				{
					id: "LSC_1001",
					building: "LSC",
					number: "1001",
					type: "Lecture Hall",
					furniture: "Fixed Tablet Arm Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/LSC-1001",
					seats: 350,
				},
				{
					id: "LSC_1002",
					building: "LSC",
					number: "1002",
					type: "Lecture Hall",
					furniture: "Fixed Tablet Arm Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/LSC-1002",
					seats: 250,
				},
				{
					id: "LSC_2001",
					building: "LSC",
					number: "2001",
					type: "Laboratory",
					furniture: "Lab Benches/Stools",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/LSC-2001",
					seats: 48,
				},
				{
					id: "LSC_3005",
					building: "LSC",
					number: "3005",
					type: "Seminar",
					furniture: "Movable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/LSC-3005",
					seats: 30,
				},
				{
					id: "LSC_3010",
					building: "LSC",
					number: "3010",
					type: "Open Design General Purpose",
					furniture: "Movable Tables & Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/LSC-3010",
					seats: 72,
				},
				{
					id: "LSC_3011",
					building: "LSC",
					number: "3011",
					type: "Small Group",
					furniture: "Tables and Chairs",
					href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/LSC-3011",
					seats: 16,
				},
			],
		},
	];

	for (const building of buildings) {
		await putJson(`/api/v2/buildings/${building.id}`, {
			name: building.name,
			address: building.address,
			lat: building.lat,
			lon: building.lon,
		});

		for (const room of building.rooms) {
			await putJson(`/api/v2/buildings/${building.id}/rooms/${room.id}`, room);
		}
	}
}

async function populateBuildingOptions() {
	const data = await apiJson("/api/v2/buildings?limit=100&offset=0");
	const previous = facilitiesBuildingSelect.value;

	facilitiesBuildingSelect.innerHTML =
		`<option value="">All buildings</option>` +
		data.items
			.map(
				(building) =>
					`<option value="${escapeHtml(building.id)}">${escapeHtml(building.id)} — ${escapeHtml(building.name)}</option>`
			)
			.join("");

	const exists = Array.from(facilitiesBuildingSelect.options).some((option) => option.value === previous);
	facilitiesBuildingSelect.value = exists ? previous : "";
}

async function queryV2(kind, query) {
	return apiJson("/api/v2/search", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ kind, query }),
	});
}

async function fetchDeptAverages() {
	return queryV2("course_offerings", {
		WHERE: buildFilterQuery(),
		OPTIONS: {
			COLUMNS: ["dept", "overallAvg"],
			ORDER: { dir: "DOWN", keys: ["overallAvg", "dept"] },
		},
		TRANSFORMATIONS: {
			GROUP: ["dept"],
			APPLY: [{ overallAvg: { AVG: "avg" } }],
		},
	});
}

async function fetchRoomTypeCounts() {
	const selectedBuilding = facilitiesBuildingSelect.value.trim();

	return queryV2("facilities", {
		WHERE: selectedBuilding ? { IS: { building: selectedBuilding } } : {},
		OPTIONS: {
			COLUMNS: ["type", "roomCount"],
			ORDER: { dir: "DOWN", keys: ["roomCount", "type"] },
		},
		TRANSFORMATIONS: {
			GROUP: ["type"],
			APPLY: [{ roomCount: { COUNT: "number" } }],
		},
	});
}

async function fetchBuildingCapacity() {
	return queryV2("facilities", {
		WHERE: {},
		OPTIONS: {
			COLUMNS: ["building", "name", "lat", "lon", "roomCount", "maxSeats", "totalSeats"],
			ORDER: { dir: "DOWN", keys: ["totalSeats", "building"] },
		},
		TRANSFORMATIONS: {
			GROUP: ["building", "name", "lat", "lon"],
			APPLY: [{ roomCount: { COUNT: "number" } }, { maxSeats: { MAX: "seats" } }, { totalSeats: { SUM: "seats" } }],
		},
	});
}

function renderHorizontalBarChart(svg, rows, labelKey, valueKey, formatter) {
	if (!rows.length) {
		renderEmptySvg(svg, "No data for this view.");
		return;
	}

	const width = 640;
	const labelWidth = 120;
	const rowHeight = 28;
	const chartWidth = 420;
	const height = rows.length * rowHeight + 24;
	const maxValue = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);

	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

	svg.innerHTML = rows
		.map((row, index) => {
			const label = String(row[labelKey]);
			const value = Number(row[valueKey]);
			const y = 10 + index * rowHeight;
			const barWidth = (value / maxValue) * chartWidth;

			return `
				<g>
					<title>${escapeHtml(label)}: ${escapeHtml(formatter(value))}</title>
					<text x="8" y="${y + 14}">${escapeHtml(truncateLabel(label, 15))}</text>
					<rect class="chart-bar" x="${labelWidth}" y="${y}" width="${barWidth}" height="18" rx="4"></rect>
					<text x="${labelWidth + barWidth + 8}" y="${y + 14}">${escapeHtml(formatter(value))}</text>
				</g>
			`;
		})
		.join("");
}

function renderVerticalBarChart(svg, rows, labelKey, valueKey, formatter) {
	if (!rows.length) {
		renderEmptySvg(svg, "No data for this view.");
		return;
	}

	const width = 640;
	const height = 320;
	const padLeft = 36;
	const padRight = 16;
	const padTop = 18;
	const padBottom = 96;
	const chartWidth = width - padLeft - padRight;
	const chartHeight = height - padTop - padBottom;
	const maxValue = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);
	const slotWidth = chartWidth / rows.length;
	const barWidth = Math.min(48, slotWidth * 0.65);

	const bars = rows
		.map((row, index) => {
			const label = String(row[labelKey]);
			const value = Number(row[valueKey]);
			const x = padLeft + index * slotWidth + (slotWidth - barWidth) / 2;
			const barHeight = (value / maxValue) * chartHeight;
			const y = padTop + chartHeight - barHeight;

			return `
				<g>
					<title>${escapeHtml(label)}: ${escapeHtml(formatter(value))}</title>
					<rect class="chart-bar-muted" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4"></rect>
					<text x="${x + barWidth / 2}" y="${padTop + chartHeight + 18}" text-anchor="middle">
						${escapeHtml(truncateLabel(label, 12))}
					</text>
					<text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle">
						${escapeHtml(formatter(value))}
					</text>
				</g>
			`;
		})
		.join("");

	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	svg.innerHTML = `
		<line class="chart-axis" x1="${padLeft}" y1="${padTop + chartHeight}" x2="${width - padRight}" y2="${padTop + chartHeight}"></line>
		${bars}
	`;
}

function renderScatterPlot(svg, rows) {
	if (!rows.length) {
		renderEmptySvg(svg, "No data for this view.");
		return;
	}

	const topN = Number.parseInt(topNInput.value, 10) || 6;
	const points = [...rows].sort((a, b) => Number(b.totalSeats) - Number(a.totalSeats)).slice(0, topN);

	const width = 640;
	const height = 320;
	const padLeft = 58;
	const padRight = 20;
	const padTop = 20;
	const padBottom = 42;
	const chartWidth = width - padLeft - padRight;
	const chartHeight = height - padTop - padBottom;

	const maxRooms = Math.max(...points.map((row) => Number(row.roomCount) || 0), 1);
	const maxSeats = Math.max(...points.map((row) => Number(row.maxSeats) || 0), 1);
	const maxTotalSeats = Math.max(...points.map((row) => Number(row.totalSeats) || 0), 1);

	const scaleX = (value) => padLeft + (Number(value) / maxRooms) * chartWidth;
	const scaleY = (value) => padTop + chartHeight - (Number(value) / maxSeats) * chartHeight;

	const svgPoints = points
		.map((row) => {
			const x = scaleX(row.roomCount);
			const y = scaleY(row.maxSeats);
			const r = 6 + (Number(row.totalSeats) / maxTotalSeats) * 10;

			return `
				<g>
					<title>${escapeHtml(row.building)} — ${escapeHtml(row.name)}
Rooms: ${escapeHtml(row.roomCount)}
Max seats: ${escapeHtml(row.maxSeats)}
Total seats: ${escapeHtml(row.totalSeats)}</title>
					<circle class="chart-point" cx="${x}" cy="${y}" r="${r}"></circle>
					<text class="chart-point-label" x="${x + r + 4}" y="${y + 4}">
						${escapeHtml(row.building)}
					</text>
				</g>
			`;
		})
		.join("");

	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	svg.innerHTML = `
		<line class="chart-axis" x1="${padLeft}" y1="${padTop + chartHeight}" x2="${width - padRight}" y2="${padTop + chartHeight}"></line>
		<line class="chart-axis" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + chartHeight}"></line>

		<text x="${width / 2}" y="${height - 8}" text-anchor="middle">Room count</text>
		<text x="16" y="${height / 2}" transform="rotate(-90 16 ${height / 2})" text-anchor="middle">Largest room seats</text>

		${svgPoints}
	`;
}

async function loadInsights() {
	setInsightsStatus("Loading insights...");

	try {
		await populateBuildingOptions();

		const [deptRows, roomTypeRows, buildingRows] = await Promise.all([
			fetchDeptAverages(),
			fetchRoomTypeCounts(),
			fetchBuildingCapacity(),
		]);

		const topRoomTypeRows = [...roomTypeRows].slice(0, 5);

		renderHorizontalBarChart(deptAvgChart, deptRows, "dept", "overallAvg", (value) => value.toFixed(2));
		renderVerticalBarChart(roomTypeChart, topRoomTypeRows, "type", "roomCount", (value) => String(value));
		renderScatterPlot(buildingCapacityChart, buildingRows);

		setInsightsStatus("Insights updated from backend data.");
	} catch (err) {
		renderEmptySvg(deptAvgChart, "Unable to load chart.");
		renderEmptySvg(roomTypeChart, "Unable to load chart.");
		renderEmptySvg(buildingCapacityChart, "Unable to load chart.");
		setInsightsStatus(`Unable to load insights: ${err.message}`);
	}
}

async function fetchDatasetStatus(uploadId) {
	const res = await fetch(`/api/v2/datasets/${uploadId}?t=${Date.now()}`, {
		method: "GET",
		cache: "no-store",
	});
	if (!res.ok) {
		throw new Error(`Status check failed (${res.status})`);
	}
	return res.json();
}

async function pollDatasetStatus(uploadId) {
	const start = Date.now();

	while (Date.now() - start < POLL_TIMEOUT_MS) {
		const body = await fetchDatasetStatus(uploadId);
		if (body.status === "completed" || body.status === "failed") {
			return body;
		}

		setStatus("Processing dataset...", "status-processing");
		await sleep(POLL_INTERVAL_MS);
	}

	throw new Error("Timed out waiting for dataset processing.");
}

function inferDatasetKind(file) {
	const explicit = datasetKindSelect?.value;
	if (explicit === "course_offerings" || explicit === "facilities") {
		return explicit;
	}

	const filename = file.name.toLowerCase();
	if (
		filename.includes("campus") ||
		filename.includes("facilities") ||
		filename.includes("building") ||
		filename.includes("room")
	) {
		return "facilities";
	}

	return "course_offerings";
}

function datasetFailureHint(kind) {
	if (kind === "facilities") {
		return "Make sure the zip contains index.htm at the root and linked building HTML files.";
	}
	return "Make sure the zip contains a top-level 'courses/' folder with valid course JSON files.";
}

async function handleDatasetUpload() {
	const file = fileInput.files[0];
	if (!file) {
		setStatus("Please select a zip file first.", "status-error");
		renderError("No file selected.");
		return;
	}

	const selectedKind = inferDatasetKind(file);

	resultContainer.innerHTML = "";
	uploadBtn.disabled = true;
	setStatus("Uploading dataset...", "status-processing");

	try {
		const formData = new FormData();
		formData.append("kind", selectedKind);
		formData.append("archive", file);

		const uploadRes = await fetch("/api/v2/datasets", {
			method: "POST",
			body: formData,
		});

		const uploadBody = await uploadRes.json();
		if (!uploadRes.ok) {
			setStatus("Upload failed", "status-error");
			renderError(
				uploadBody.message || uploadBody.error || "Failed to start dataset upload.",
				datasetFailureHint(selectedKind)
			);
			return;
		}

		setStatus("Processing dataset...", "status-processing");
		await pollDatasetStatus(uploadBody.id);
		const finalStatus = await fetchDatasetStatus(uploadBody.id);

		if (finalStatus.status === "completed") {
			setStatus("Processing complete", "status-success");
			renderUploadSuccess(finalStatus);
			await Promise.all([loadOfferings(), loadInsights()]);
		} else {
			setStatus("Processing failed", "status-error");
			renderError(finalStatus.message || "Dataset processing failed.", datasetFailureHint(selectedKind));
		}
	} catch (err) {
		setStatus("Processing failed", "status-error");
		renderError(
			err.message || "Unexpected error during dataset upload.",
			"Please retry. If this keeps happening, restart the backend server and try again."
		);
	} finally {
		uploadBtn.disabled = false;
	}
}

async function handleClickMe() {
	const res = await fetch("/api", { method: "GET" });
	if (res.ok) {
		apiStatusOutput.textContent = await res.text();
		return;
	}
	apiStatusOutput.textContent = res.statusText;
}