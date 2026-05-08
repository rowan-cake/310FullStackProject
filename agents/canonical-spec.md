# InsightUBC v2 Canonical Spec

This file is a cleaned agent-readable companion to the extracted OpenAPI document.

Use this file for:
- understanding required behavior quickly
- identifying binding constraints
- scoping implementation work

Use `insightubc-v2-openapi.json` for:
- exact request and response schemas
- exact parameter names
- exact endpoint inventory
- source-of-truth OpenAPI details

## Source
- extracted from `insightubc-v2-spec.html`
- canonical machine-readable copy: `insightubc-v2-openapi.json`

## Global Notes
- integer fields are validated according to JavaScript `Number.isInteger`
- IDs are case-sensitive
- changelog note from spec:
  - Mar 9, 2026: applykey validation message changed to `"applykey cannot be empty or contain underscore"`
  - Mar 11, 2026: PUT room response schema corrected

## Endpoint Inventory

### Dataset upload and status
- `POST /api/v1/datasets` deprecated, use v2
- `GET /api/v1/datasets/{id}` deprecated, use v2
- `POST /api/v2/datasets`
- `GET /api/v2/datasets/{id}`

### Search
- `POST /api/v1/search` deprecated, use v2
- `POST /api/v2/search`

### Courses and sections
- `GET /api/v1/courses`
- `GET /api/v1/courses/{course}`
- `PUT /api/v1/courses/{course}`
- `DELETE /api/v1/courses/{course}`
- `GET /api/v1/courses/{course}/sections`
- `GET /api/v1/courses/{course}/sections/{section}`
- `PUT /api/v1/courses/{course}/sections/{section}`
- `DELETE /api/v1/courses/{course}/sections/{section}`

### Buildings and rooms
- `GET /api/v2/buildings`
- `GET /api/v2/buildings/{building}`
- `PUT /api/v2/buildings/{building}`
- `DELETE /api/v2/buildings/{building}`
- `GET /api/v2/buildings/{building}/rooms`
- `GET /api/v2/buildings/{building}/rooms/{room}`
- `PUT /api/v2/buildings/{building}/rooms/{room}`
- `DELETE /api/v2/buildings/{building}/rooms/{room}`

## Stable Pagination Rules
- `GET /api/v1/courses` results are ordered by `id` ascending
- `GET /api/v2/buildings` results are ordered by `id` ascending
- `GET /api/v1/courses/{course}/sections` supports `limit` and `offset`
- `GET /api/v2/buildings/{building}/rooms` supports `limit` and `offset`

## Dataset Upload Rules

### Shared behavior
- upload endpoint accepts multipart form data
- upload returns `202` immediately
- processing happens asynchronously
- status must be checked using `GET /api/v2/datasets/{id}`

### Course offerings upload
Request:
- `kind = "course_offerings"`
- `archive` is a zip file

Archive requirements:
- root directory named `courses/`
- one or more JSON files inside `courses/`
- each valid file has a `result` array

Required offering fields:
- `id: string`
- `Course: string`
- `Title: string`
- `Professor: string`
- `Subject: string`
- `Section: string`
- `Year: string`
- `Avg: number`
- `Pass: number`
- `Fail: number`
- `Audit: number`

Async processing rules:
- fail with `"Data is not in a valid zip format"` if archive is not a valid zip
- fail with `"Missing root courses directory"` if `courses/` is missing
- skip files that are invalid JSON or missing `result`
- course id is `Subject + Course`
- course fields map to:
  - `code <- Course`
  - `title <- most recent Title`
  - `dept <- Subject`
- section id is the offering `id`
- section fields map to:
  - `instructor <- Professor`
  - `year <- Number(Year)` except use `1900` when `Section === "overall"`
  - `avg <- Avg`
  - `pass <- Pass`
  - `fail <- Fail`
  - `audit <- Audit`
- records with missing or non-convertible required fields are skipped
- courses are processed before sections

### Facilities upload
Request:
- `kind = "facilities"`
- `archive` is a zip file

Archive requirements:
- `index.htm` at zip root
- one or more linked HTML files containing building/room information

Async processing rules:
- fail with `"Data is not in a valid zip format"` if archive is invalid
- fail with `"Missing index.htm file"` if missing
- fail with `"index.htm could not be parsed"` if parsing fails
- fail with `"No building table found in index.htm"` if no `views-table` building table exists

Building extraction from `index.htm`:
- `fullname` from `<a>` inside `.views-field-title`
- `shortname` from `.views-field-field-building-code`
- `address` from `.views-field-field-building-address`
- `link` from the `<a>` in `.views-field-title`
- skip row if any required element/class is missing

Room extraction from linked building pages:
- locate table with class `views-table`
- `number` from `<a>` inside `.views-field-field-room-number`
- `seats` from `.views-field-field-room-capacity`
- `furniture` from `.views-field-field-room-furniture`
- `type` from `.views-field-field-room-type`
- `href` from `<a>` in `.views-field-nothing`
- skip row if required element/class is missing
- if linked file is missing, unparsable, or lacks a room table, extract no rooms for that building

Geolocation:
- send GET request using URL-encoded building address
- use returned `lat` and `lon`
- if request fails or response contains `error`, skip that building

Load rules:
- building id is `shortname`
- building fields:
  - `name <- fullname`
  - `address <- address`
  - `lat <- geolocation lat`
  - `lon <- geolocation lon`
- room id is `shortname_number`
- room fields:
  - `building <- shortname`
  - `number <- room number`
  - `seats <- seats`
  - `type <- type`
  - `furniture <- furniture`
  - `href <- href`
- validate loaded building data using the same rules as `PUT /api/v2/buildings/{building}`
- validate loaded room data using the same rules as `PUT /api/v2/buildings/{building}/rooms/{room}`
- buildings are processed before rooms

## Search Rules

### Request shape
`SearchRequest` requires:
- `kind`
- `query`

Supported kinds:
- `course_offerings`
- `facilities`

### Query language
The spec defines a DSL with:
- `WHERE`
- `OPTIONS`
- optional `TRANSFORMATIONS`

Supported filter categories:
- logical comparisons: `AND`, `OR`
- numeric comparisons: `LT`, `GT`, `EQ`
- string comparison: `IS`
- negation: `NOT`

### Field sets

#### `course_offerings`
- mfields: `avg`, `pass`, `fail`, `audit`, `year`
- sfields: `title`, `dept`, `code`, `instructor`

#### `facilities`
- mfields: `lat`, `lon`, `seats`
- sfields: `address`, `building`, `furniture`, `href`, `name`, `number`, `type`

### Cross-kind restriction
- all fields used in a query must belong to the same `kind`
- mixing course and facilities fields in one query is invalid

### Aggregation and transformations
Supported `APPLYTOKEN`s:
- `MAX`
- `MIN`
- `AVG`
- `COUNT`
- `SUM`

Binding rules:
- `MAX`, `MIN`, `AVG`, `SUM` only operate on mfields
- `COUNT` may operate on any field
- applykeys must be unique
- if `GROUP` is present, every `COLUMNS` entry must be either:
  - a `GROUP` key, or
  - an applykey defined in `APPLY`

### Sorting
Supported forms:
- single-key v1 style: `"ORDER": "avg"`
- multi-key style:

```json
{
  "ORDER": {
    "dir": "DOWN",
    "keys": ["maxSeats"]
  }
}
```

Rules:
- all sort keys must appear in `COLUMNS`
- `dir` is `UP` or `DOWN`
- later keys break ties from earlier keys
- relative order of unresolved ties is not guaranteed

### Wildcards
Allowed `IS` wildcard patterns:
- `inputstring` exact match
- `*inputstring` ends with inputstring
- `inputstring*` starts with inputstring
- `*inputstring*` contains inputstring

Invalid:
- asterisks in the middle, such as `input*string`

### Search response and errors
- `200` successful results
- `400` query does not conform to EBNF grammar
- `413` query would return more than 5000 results
- `422` validation error in request body

`TooLargeError` exact payload fields include:
- `error = "Too many results"`
- `message = "Query would return more than 5000 results"`
- `limit = 5000`

## Resource Models

### Course
Fields:
- `id` read-only
- `title`
- `dept`
- `code`
- `links.self`
- `links.sections`

### Section
Fields:
- `id` read-only
- `instructor`
- `year`
- `avg`
- `pass`
- `fail`
- `audit`
- `links.self`
- `links.course`

### Building
Fields:
- `id` read-only
- `name`
- `address`
- `lat`
- `lon`
- `links.self`
- `links.rooms`

### Room
Fields:
- `id` read-only
- `building`
- `number`
- `type`
- `furniture`
- `href`
- `seats`
- `links.self`
- `links.building`

## CRUD Semantics

### Course / building PUT
- `201` when created
- `204` when replaced
- `422` on validation failure

### Section / room PUT
- `201` when created
- `204` when replaced
- `404` if parent course/building does not exist
- `422` on validation failure

### Course / building DELETE
- `200` when deleted
- `404` if not found
- building delete returns building metadata plus count of deleted rooms

### Section / room DELETE
- `200` when deleted
- `404` if not found
- room delete returns deleted room data

## Upload Status Schemas

### `CourseOfferingsUploadStats`
- `files_total`
- `files_processed`
- `files_skipped`
- `courses_seen`
- `courses_added`
- `courses_modified`
- `sections_seen`
- `sections_added`
- `sections_modified`

### `FacilitiesUploadStats`
- `buildings_added`
- `buildings_modified`
- `rooms_added`
- `rooms_modified`

## Validation And Not Found Schemas

### `ValidationError`
- `error = "Validation failed"`
- `fields` object

### `NotFoundError`
- `error = "Not found"`
- `message`

## Agent Usage Notes
- prefer `description.md` for task scope and implementation priorities
- prefer `canonical-spec.md` for normalized rules and endpoint overview
- prefer `insightubc-v2-openapi.json` for exact API details and schema references
- when behavior seems ambiguous, trust `insightubc-v2-openapi.json` over this summary
