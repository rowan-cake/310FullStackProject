"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const project_support_1 = require("@ubccpsc310/project-support");
const App_1 = require("./App");
project_support_1.Log.info("App - starting");
const port = process.env.PORT || "4321";
const datadir = process.env.DATA_DIR || "./data";
(async () => {
    const app = await (0, App_1.createApp)({ datadir });
    const server = app
        .listen(port, () => {
        const address = server.address();
        const host = address && typeof address === "object" ? address.address : "localhost";
        const actualHost = host === "::" ? "localhost" : host;
        const url = `http://${actualHost}:${port}`;
        project_support_1.Log.info(`Server running at ${url}`);
    })
        .on("error", (err) => {
        project_support_1.Log.error(`Failed to start server: ${err.message}`);
    });
})();
//# sourceMappingURL=index.js.map