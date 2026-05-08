"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const parse5_1 = require("parse5");
async function main() {
    if (process.argv.includes("--help")) {
        printHelp();
        return;
    }
    const config = loadConfig(process.argv.slice(2));
    const client = new CanvasClient(config.baseUrl, config.token);
    const assignment = await client.getAssignment(config.courseId, config.assignmentId, config.include);
    const output = buildMarkdown(assignment, config);
    await promises_1.default.writeFile(config.outputFile, output, "utf8");
    console.log(`Wrote checkpoint context to ${config.outputFile}`);
}
class CanvasClient {
    baseUrl;
    token;
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }
    async getAssignment(courseId, assignmentId, include) {
        const query = new URLSearchParams();
        for (const entry of include) {
            query.append("include[]", entry);
        }
        const response = await fetch(`${this.baseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}${query.size > 0 ? `?${query.toString()}` : ""}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`Canvas request failed: ${response.status} ${response.statusText} for assignment ${assignmentId} in course ${courseId}`);
        }
        return (await response.json());
    }
}
function loadConfig(args) {
    const argMap = parseArgs(args);
    const baseUrl = normalizeBaseUrl(argMap["base-url"] ?? process.env.CANVAS_BASE_URL);
    const token = argMap.token ?? process.env.CANVAS_TOKEN;
    const courseId = argMap["course-id"] ?? process.env.CANVAS_COURSE_ID;
    const assignmentId = argMap["assignment-id"] ?? process.env.CANVAS_ASSIGNMENT_ID;
    const outputFile = path_1.default.resolve(argMap.output ?? process.env.CANVAS_CONTEXT_OUTPUT ?? "checkpoint2-context.md");
    const include = parseInclude(argMap.include ?? process.env.CANVAS_ASSIGNMENT_INCLUDE);
    if (!baseUrl || !token || !courseId || !assignmentId) {
        throw new Error("Missing Canvas config. Set CANVAS_BASE_URL, CANVAS_TOKEN, CANVAS_COURSE_ID, and CANVAS_ASSIGNMENT_ID, or pass the equivalent flags.");
    }
    return { baseUrl, token, courseId, assignmentId, outputFile, include };
}
function printHelp() {
    console.log(`canvas:cp2

Usage:
  yarn canvas:cp2 --base-url https://canvas.example.edu --token <token> --course-id 12345 --assignment-id 67890

Optional flags:
  --include submission,assignment_visibility
  --output checkpoint2-context.md

Environment variables:
  CANVAS_BASE_URL
  CANVAS_TOKEN
  CANVAS_COURSE_ID
  CANVAS_ASSIGNMENT_ID
  CANVAS_ASSIGNMENT_INCLUDE
  CANVAS_CONTEXT_OUTPUT`);
}
function parseArgs(args) {
    const parsed = {};
    for (let index = 0; index < args.length; index += 1) {
        const key = args[index];
        if (!key.startsWith("--")) {
            continue;
        }
        const value = args[index + 1];
        if (value && !value.startsWith("--")) {
            parsed[key.slice(2)] = value;
            index += 1;
        }
    }
    return parsed;
}
function parseInclude(raw) {
    if (!raw) {
        return [];
    }
    return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
function normalizeBaseUrl(baseUrl) {
    if (!baseUrl) {
        return undefined;
    }
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}
function buildMarkdown(assignment, config) {
    const lines = [];
    lines.push("# Checkpoint Context");
    lines.push("");
    lines.push("This file is generated from Canvas LMS using the single assignment endpoint.");
    lines.push("");
    lines.push("## Source");
    lines.push("");
    lines.push(`- Course ID: ${config.courseId}`);
    lines.push(`- Assignment ID: ${config.assignmentId}`);
    lines.push(`- Canvas URL: ${assignment.html_url ?? "Unavailable"}`);
    lines.push(`- Included associations: ${config.include.length > 0 ? config.include.join(", ") : "none"}`);
    lines.push("");
    lines.push("## Assignment Metadata");
    lines.push("");
    lines.push(`- Name: ${assignment.name}`);
    lines.push(`- Points: ${assignment.points_possible ?? "Unavailable"}`);
    lines.push(`- Due: ${assignment.due_at ?? "Unavailable"}`);
    lines.push(`- Unlocks: ${assignment.unlock_at ?? "Unavailable"}`);
    lines.push(`- Locks: ${assignment.lock_at ?? "Unavailable"}`);
    lines.push(`- Published: ${assignment.published ?? "Unavailable"}`);
    lines.push(`- Grading type: ${assignment.grading_type ?? "Unavailable"}`);
    lines.push(`- Submission types: ${assignment.submission_types?.join(", ") ?? "Unavailable"}`);
    lines.push(`- Has overrides: ${assignment.has_overrides ?? "Unavailable"}`);
    lines.push("");
    lines.push("## Goals and Requirements");
    lines.push("");
    lines.push(htmlToMarkdown(assignment.description ?? "<p>No assignment description was returned by Canvas.</p>").trim());
    lines.push("");
    if ((assignment.attachments?.length ?? 0) > 0) {
        lines.push("## Attachments");
        lines.push("");
        for (const attachment of assignment.attachments ?? []) {
            lines.push(`- ${attachment.display_name}${attachment.filename ? ` (${attachment.filename})` : ""}${attachment.url ? `: ${attachment.url}` : ""}`);
        }
        lines.push("");
    }
    lines.push("## Agent Notes");
    lines.push("");
    lines.push("- Treat the metadata and assignment description above as the canonical Canvas source.");
    lines.push("- Pull requirements directly from the 'Goals and Requirements' section before making repo changes.");
    lines.push("- If the assignment references external docs not embedded here, fetch those separately and append them manually.");
    lines.push("- Keep agent work scoped to what is actually stated in this file.");
    lines.push("");
    return `${lines.join("\n")}\n`;
}
function htmlToMarkdown(html) {
    const fragment = (0, parse5_1.parseFragment)(html);
    const rendered = fragment.childNodes.map((node) => renderNode(node)).join("");
    return rendered.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function renderNode(node) {
    if (isTextNode(node)) {
        return node.value.replace(/\s+/g, " ");
    }
    if (!isElementNode(node)) {
        return "";
    }
    const children = (node.childNodes ?? []).map((child) => renderNode(child)).join("");
    switch (node.tagName) {
        case "h1":
            return `# ${children.trim()}\n\n`;
        case "h2":
            return `## ${children.trim()}\n\n`;
        case "h3":
            return `### ${children.trim()}\n\n`;
        case "p":
            return `${children.trim()}\n\n`;
        case "br":
            return "\n";
        case "strong":
        case "b":
            return `**${children.trim()}**`;
        case "em":
        case "i":
            return `*${children.trim()}*`;
        case "code":
            return `\`${children.trim()}\``;
        case "pre":
            return `\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
        case "ul":
            return renderList(node, false);
        case "ol":
            return renderList(node, true);
        case "a": {
            const href = node.attrs.find((attr) => attr.name === "href")?.value ?? "";
            return `[${children.trim() || href}](${href})`;
        }
        default:
            return children;
    }
}
function renderList(node, ordered) {
    const items = (node.childNodes ?? [])
        .filter(isElementNode)
        .filter((child) => child.tagName === "li")
        .map((child, index) => `${ordered ? `${index + 1}.` : "-"} ${renderNode(child).trim()}`)
        .join("\n");
    return `${items}\n\n`;
}
function isTextNode(node) {
    return typeof node === "object" && node !== null && "value" in node;
}
function isElementNode(node) {
    return typeof node === "object" && node !== null && "tagName" in node && "attrs" in node;
}
void main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
//# sourceMappingURL=canvasCheckpointContext.js.map