import { FolderTestOptions } from "./types";
import { Suite } from "mocha";
declare function folderTest<I, O, E>(suiteName: string, target: (input: I) => unknown, folder: string, options?: Partial<FolderTestOptions<I, O, E>>): Suite;
export { folderTest };
