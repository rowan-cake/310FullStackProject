# Checkpoint 2 Implementation Brief

## Objective
Extend the Checkpoint 1 system to support facilities data alongside course offerings.

The implementation must add:
- facilities dataset ingestion from HTML zip archives
- buildings and rooms REST resources
- `facilities` as a searchable data kind
- `GROUP` / aggregate functions and multi-key `ORDER`
- persistence, validation, and tests

## PR Scope
An agent working from this file should target one backend-focused PR unless told otherwise.

Primary scope:
- backend API changes
- facilities ingestion pipeline
- search enhancements
- test coverage for new behavior

Out of scope for the first PR unless explicitly requested:
- frontend visual insights
- README polish beyond required backend-facing notes
- unrelated refactors

## Must Preserve
- existing `course_offerings` behavior must continue working
- deprecated v1 endpoints must remain backwards compatible
- async dataset upload behavior must still return `202`
- persisted data must survive server restarts

## Required API Changes

### Dataset APIs
Maintain existing v1 endpoints and add/maintain v2 equivalents where applicable.

Relevant requirements:
- `course_offerings` remains supported
- add support for `kind: "facilities"`
- upload routing must dispatch by `kind`

### Existing v1 endpoints that remain standard
- `/api/v1/courses`
- `/api/v1/courses/{course}/sections`

### v1 endpoints that must remain for backwards compatibility
- `/api/v1/datasets`
- `/api/v1/datasets/{id}`
- `/api/v1/search`

### New / updated v2 endpoints
- `/api/v2/datasets`
- `/api/v2/search`
- `/api/v2/buildings`
- `/api/v2/buildings/{building}`
- `/api/v2/buildings/{building}/rooms`
- `/api/v2/buildings/{building}/rooms/{room}`

## Buildings And Rooms Endpoints

### Buildings
- `GET /api/v2/buildings`: paginated list of buildings
- `GET /api/v2/buildings/{building}`: get one building
- `PUT /api/v2/buildings/{building}`: create or replace a building
- `DELETE /api/v2/buildings/{building}`: delete a building and return count of deleted rooms

### Rooms
- `GET /api/v2/buildings/{building}/rooms`: paginated list of rooms in a building
- `GET /api/v2/buildings/{building}/rooms/{room}`: get one room
- `PUT /api/v2/buildings/{building}/rooms/{room}`: create or replace a room
- `DELETE /api/v2/buildings/{building}/rooms/{room}`: delete a room and return its data

### Resource integrity rules
- rooms cannot exist without a parent building
- deleting a building must delete all child rooms
- building/room behavior should mirror the style of existing courses/sections endpoints

## Facilities Dataset Processing

### Input format
The facilities zip archive contains:
- `index.htm` at the root listing buildings
- building HTML files in subdirectories containing room information

### Parsing requirements
- must use `parse5`
- do not hardcode DOM traversal by positional indexing
- recursively search the parsed document tree
- find relevant `<table>` elements
- identify valid rows/cells by CSS class matching, not by fixed tree position

### Implementation guidance that should be treated as binding
- parse HTML into a traversable JSON tree with `parse5`
- inspect table cells (`<td>`) for specific CSS classes
- extract building and room fields by class-based matching
- implementation must tolerate HTML structure variation

### Geolocation requirements
For each building, fetch latitude and longitude from:

```text
http://cs310.students.cs.ubc.ca:11316/api/v1/project_team<TEAM_NUMBER>/<ADDRESS>
```

Rules:
- `<TEAM_NUMBER>` must be replaced with the actual team number
- `<ADDRESS>` must be encoded with `encodeURIComponent()`
- the address must match the dataset exactly or the service may return `404`
- response shape is `{ lat?: number; lon?: number; error?: string }`
- if geolocation fails for a building, skip that building and all of its rooms

## Search Enhancements

### Supported kinds
- `course_offerings`
- `facilities`

### Queryable fields

#### `course_offerings`
- mfields: `avg`, `pass`, `fail`, `audit`, `year`
- sfields: `title`, `dept`, `code`, `instructor`

#### `facilities`
- mfields: `lat`, `lon`, `seats`
- sfields: `name`, `building`, `address`, `number`, `type`, `furniture`, `href`

### Validation requirement
Queries must reject cross-kind field use. Example:
- `avg` is invalid for `facilities`
- `seats` is invalid for `course_offerings`

## Transformations

### Required aggregate support
Implement `GROUP` with these aggregate functions:
- `MAX`
- `MIN`
- `AVG`
- `SUM`
- `COUNT`

### Binding validation rules
- all `GROUP` keys must appear in `COLUMNS`
- all `COLUMNS` not in `GROUP` must come from `APPLY`
- all apply keys must be unique
- `MAX`, `MIN`, `AVG`, and `SUM` must operate on mfields
- `COUNT` may operate on any field

### AVG implementation requirements
Use `Decimal.js` exactly as follows:
1. convert each value with `new Decimal(num)`
2. accumulate using `add()`
3. divide using `total.toNumber() / numRows`
4. round with `toFixed(2)` and cast back with `Number(...)`

This exact approach is required for consistent grading behavior.

### SUM implementation requirements
- round to 2 decimal places with `toFixed(2)`
- cast back to number

### COUNT behavior
- return the number of unique occurrences of a field within the group

## Ordering

### Backwards compatibility
- existing single-key ordering must continue to work
- if `ORDER` is absent, result ordering remains unspecified

### New requirement
Support multi-key ordering using:

```json
{
  "dir": "UP",
  "keys": ["fieldA", "fieldB"]
}
```

Rules:
- every `ORDER` key must appear in `COLUMNS`
- `UP` means ascending for all keys
- `DOWN` means descending for all keys
- keys are applied in order for tie-breaking
- use `<` comparisons, not `localeCompare()`

## Async And Persistence Requirements
- dataset uploads must continue returning `202` immediately
- facilities jobs must be tracked correctly by the async processing system
- error handling should remain deterministic and testable
- buildings, rooms, courses, and sections must survive restart

## Testing Requirements
Agents implementing this should add tests for:
- facilities zip ingestion success path
- invalid or malformed facilities archives
- HTML parsing and table discovery
- geolocation success and failure handling
- facilities search queries
- grouping and aggregate correctness
- multi-key sorting
- validation errors for invalid queries
- referential integrity for building/room deletion
- regression coverage for existing `course_offerings` behavior

## Recommended Implementation Order
1. Add buildings and rooms REST endpoints and persistence model changes.
2. Add facilities upload routing and HTML parsing.
3. Add geolocation integration.
4. Add `facilities` query support.
5. Add `GROUP` / `APPLY` support.
6. Add multi-key `ORDER`.
7. Add and tighten tests.

## Acceptance Criteria
The implementation is acceptable only if:
- facilities archives upload and persist successfully
- buildings and rooms endpoints behave correctly
- deleting a building cascades to rooms
- `facilities` queries work with correct field validation
- `GROUP` aggregates produce correct values
- `AVG` and `SUM` rounding match the required rules
- multi-key sort behaves deterministically
- old `course_offerings` behavior still passes
- tests cover both happy paths and validation / failure paths

## Non-Goals For This PR
Do not spend the first PR on:
- the frontend insight work
- speculative architecture cleanup
- unrelated style changes
- large rewrites that are not required to meet the checkpoint spec

## References
- Canvas page: `https://canvas.ubc.ca/courses/176257/pages/insightubc-v2-project-specification`

