import { FolderTestOptions } from "./types";
declare function getDefaultOptions<I, O, E>(): FolderTestOptions<I, O, E>;
declare function joinWithDefaultOptions<I, O, E>(provided: Partial<FolderTestOptions<I, O, E>>): FolderTestOptions<I, O, E>;
export { getDefaultOptions, joinWithDefaultOptions, };
