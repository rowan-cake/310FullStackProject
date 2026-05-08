"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sectionToResponseGETandPUT = sectionToResponseGETandPUT;
exports.sectionToResponseDEL = sectionToResponseDEL;
function sectionToResponseGETandPUT(courseId, sectionId, section) {
    return {
        id: sectionId,
        instructor: section.instructor,
        year: section.year,
        avg: section.avg,
        pass: section.pass,
        fail: section.fail,
        audit: section.audit,
        links: {
            self: `/api/v1/courses/${courseId}/sections/${sectionId}`,
            course: `/api/v1/courses/${courseId}`,
        },
    };
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
//# sourceMappingURL=sectionResponses.js.map