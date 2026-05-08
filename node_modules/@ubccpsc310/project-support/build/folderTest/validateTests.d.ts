import { FolderTestOptions, FolderTestSchemaWithFilename } from "./types";
declare function validateTests<I, O, E>(maybeTests: Array<{
    filename: string;
}>, options: FolderTestOptions<I, O, E>): maybeTests is Array<FolderTestSchemaWithFilename<I, O, E>>;
export { validateTests };
