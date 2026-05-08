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
const courseService = __importStar(require("./courseService"));
const courseSchemas_1 = require("./courseSchemas");
function toCourseResponse(courseId, course) {
    return {
        id: courseId,
        title: course.title,
        dept: course.dept,
        code: course.code,
        links: {
            self: `/api/v1/courses/${courseId}`,
            sections: `/api/v1/courses/${courseId}/sections`,
        },
    };
}
async function listCourses(req, res, next) {
    try {
        const pagination = (0, courseSchemas_1.parseCourseListPagination)(req.query);
        const result = await courseService.listCourses(pagination);
        res.status(200).json({
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            items: result.items.map((item) => toCourseResponse(item.id, item.course)),
        });
    }
    catch (err) {
        next(err);
    }
}
async function getCourse(req, res, next) {
    try {
        const courseId = req.params.course;
        const result = await courseService.getCourse(courseId);
        res.status(200).json(toCourseResponse(result.id, result.course));
    }
    catch (err) {
        next(err);
    }
}
async function putCourse(req, res, next) {
    try {
        const courseId = req.params.course;
        const body = (0, courseSchemas_1.parseCourseBody)(req.body);
        const result = await courseService.putCourse(courseId, body);
        if (result.created) {
            res.status(201).json(toCourseResponse(result.id, result.course));
            return;
        }
        res.sendStatus(204);
    }
    catch (err) {
        next(err);
    }
}
async function deleteCourse(req, res, next) {
    try {
        const courseId = req.params.course;
        const result = await courseService.deleteCourse(courseId);
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=courseController.js.map