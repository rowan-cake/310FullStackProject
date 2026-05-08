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
exports.listSections = listSections;
exports.getSection = getSection;
exports.putSection = putSection;
exports.deleteSection = deleteSection;
const sectionService = __importStar(require("./sectionService"));
const sectionSchemas_1 = require("./sectionSchemas");
function toSectionResponse(courseId, sectionId, section) {
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
function toDeletedSectionResponse(sectionId, section) {
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
async function listSections(req, res, next) {
    try {
        const courseId = req.params.course;
        const pagination = (0, sectionSchemas_1.parseSectionListPagination)(req.query);
        const result = await sectionService.listSections(courseId, pagination);
        res.status(200).json({
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            items: result.items.map((item) => toSectionResponse(courseId, item.id, item.section)),
        });
    }
    catch (err) {
        next(err);
    }
}
async function getSection(req, res, next) {
    try {
        const courseId = req.params.course;
        const sectionId = req.params.section;
        const result = await sectionService.getSection(courseId, sectionId);
        res.status(200).json(toSectionResponse(courseId, result.id, result.section));
    }
    catch (err) {
        next(err);
    }
}
async function putSection(req, res, next) {
    try {
        const courseId = req.params.course;
        const sectionId = req.params.section;
        await sectionService.assertCourseExists(courseId);
        const body = (0, sectionSchemas_1.parseSectionBody)(req.body);
        const result = await sectionService.putSection(courseId, sectionId, body);
        if (result.created) {
            res.status(201).json(toSectionResponse(courseId, result.id, result.section));
            return;
        }
        res.sendStatus(204);
    }
    catch (err) {
        next(err);
    }
}
async function deleteSection(req, res, next) {
    try {
        const courseId = req.params.course;
        const sectionId = req.params.section;
        const result = await sectionService.deleteSection(courseId, sectionId);
        res.status(200).json(toDeletedSectionResponse(result.id, result.section));
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=sectionController.js.map