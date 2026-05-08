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
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCourses = listCourses;
exports.getCourse = getCourse;
exports.putCourse = putCourse;
exports.deleteCourse = deleteCourse;
const courseRepository = __importStar(require("./courseRepository"));
const NotFoundError_1 = require("../errors/NotFoundError");
async function listCourses(input) {
    const allCourses = await courseRepository.listAll();
    const items = allCourses.slice(input.offset, input.offset + input.limit);
    return {
        total: allCourses.length,
        limit: input.limit,
        offset: input.offset,
        items,
    };
}
async function getCourse(courseId) {
    const course = await courseRepository.getById(courseId);
    if (!course) {
        throw new NotFoundError_1.NotFoundError("course", courseId);
    }
    return { id: courseId, course };
}
async function putCourse(courseId, input) {
    const result = await courseRepository.upsert(courseId, input);
    return {
        created: result.created,
        id: courseId,
        course: result.course,
    };
}
async function deleteCourse(courseId) {
    const course = await courseRepository.deleteById(courseId);
    if (!course) {
        throw new NotFoundError_1.NotFoundError("course", courseId);
    }
    return {
        id: courseId,
        title: course.title,
        dept: course.dept,
        code: course.code,
        sections: Object.keys(course.sections).length,
    };
}
//# sourceMappingURL=courseService.js.map