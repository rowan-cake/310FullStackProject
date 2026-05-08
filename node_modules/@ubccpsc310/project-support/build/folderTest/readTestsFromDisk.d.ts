/**
 * Recursively searches for test query JSON files in the path and returns those matching the specified schema.
 * @param path The path to the sample query JSON files.
 */
declare function readTestsFromDisk<I, O, E>(path: string): Array<{
    filename: string;
}>;
export { readTestsFromDisk };
