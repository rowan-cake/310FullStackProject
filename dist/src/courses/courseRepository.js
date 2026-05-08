"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAll = listAll;
exports.getById = getById;
exports.upsert = upsert;
exports.deleteById = deleteById;
const databaseStore_1 = require("../storage/databaseStore");
async function listAll() {
    const database = await (0, databaseStore_1.readDB)();
    const courseIds = Object.keys(database.courses).sort();
    return courseIds.map((courseId) => ({
        id: courseId,
        course: database.courses[courseId],
    }));
}
async function getById(courseId) {
    const database = await (0, databaseStore_1.readDB)();
    return database.courses[courseId];
}
async function upsert(courseId, input) {
    const database = await (0, databaseStore_1.readDB)();
    const existingCourse = database.courses[courseId];
    if (existingCourse) {
        database.courses[courseId] = {
            title: input.title,
            dept: input.dept,
            code: input.code,
            sections: existingCourse.sections,
        };
        await (0, databaseStore_1.writeDB)(database);
        return { created: false, course: database.courses[courseId] };
    }
    database.courses[courseId] = {
        title: input.title,
        dept: input.dept,
        code: input.code,
        sections: {},
    };
    await (0, databaseStore_1.writeDB)(database);
    return { created: true, course: database.courses[courseId] };
}
async function deleteById(courseId) {
    const database = await (0, databaseStore_1.readDB)();
    const existingCourse = database.courses[courseId];
    if (!existingCourse) {
        return undefined;
    }
    delete database.courses[courseId];
    await (0, databaseStore_1.writeDB)(database);
    return existingCourse;
}
//# sourceMappingURL=courseRepository.js.map