"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCourseById = getCourseById;
exports.listSectionsByCourseId = listSectionsByCourseId;
exports.getSectionById = getSectionById;
exports.upsertSection = upsertSection;
exports.deleteSectionById = deleteSectionById;
const databaseStore_1 = require("../storage/databaseStore");
async function getCourseById(courseId) {
    const database = await (0, databaseStore_1.readDB)();
    return database.courses[courseId];
}
async function listSectionsByCourseId(courseId) {
    const database = await (0, databaseStore_1.readDB)();
    const course = database.courses[courseId];
    if (!course) {
        return [];
    }
    return Object.keys(course.sections)
        .sort()
        .map((sectionId) => ({
        id: sectionId,
        section: course.sections[sectionId],
    }));
}
async function getSectionById(courseId, sectionId) {
    const database = await (0, databaseStore_1.readDB)();
    return database.courses[courseId]?.sections[sectionId];
}
async function upsertSection(courseId, sectionId, input) {
    const database = await (0, databaseStore_1.readDB)();
    const course = database.courses[courseId];
    const created = !course.sections[sectionId];
    course.sections[sectionId] = {
        instructor: input.instructor,
        year: input.year,
        avg: input.avg,
        pass: input.pass,
        fail: input.fail,
        audit: input.audit,
    };
    await (0, databaseStore_1.writeDB)(database);
    return {
        created,
        section: course.sections[sectionId],
    };
}
async function deleteSectionById(courseId, sectionId) {
    const database = await (0, databaseStore_1.readDB)();
    const course = database.courses[courseId];
    if (!course) {
        return undefined;
    }
    const section = course.sections[sectionId];
    if (!section) {
        return undefined;
    }
    delete course.sections[sectionId];
    await (0, databaseStore_1.writeDB)(database);
    return section;
}
//# sourceMappingURL=sectionRepository.js.map