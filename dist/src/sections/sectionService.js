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
exports.assertCourseExists = assertCourseExists;
exports.listSections = listSections;
exports.getSection = getSection;
exports.putSection = putSection;
exports.deleteSection = deleteSection;
const NotFoundError_1 = require("../errors/NotFoundError");
const sectionRepository = __importStar(require("./sectionRepository"));
async function assertCourseExists(courseId) {
    const course = await sectionRepository.getCourseById(courseId);
    if (!course) {
        throw new NotFoundError_1.NotFoundError("course", courseId);
    }
}
async function listSections(courseId, input) {
    await assertCourseExists(courseId);
    const allSections = await sectionRepository.listSectionsByCourseId(courseId);
    return {
        total: allSections.length,
        limit: input.limit,
        offset: input.offset,
        items: allSections.slice(input.offset, input.offset + input.limit),
    };
}
async function getSection(courseId, sectionId) {
    await assertCourseExists(courseId);
    const section = await sectionRepository.getSectionById(courseId, sectionId);
    if (!section) {
        throw new NotFoundError_1.NotFoundError("section", sectionId);
    }
    return { id: sectionId, section };
}
async function putSection(courseId, sectionId, input) {
    const result = await sectionRepository.upsertSection(courseId, sectionId, input);
    return {
        created: result.created,
        id: sectionId,
        section: result.section,
    };
}
async function deleteSection(courseId, sectionId) {
    await assertCourseExists(courseId);
    const section = await sectionRepository.deleteSectionById(courseId, sectionId);
    if (!section) {
        throw new NotFoundError_1.NotFoundError("section", sectionId);
    }
    return { id: sectionId, section };
}
//# sourceMappingURL=sectionService.js.map