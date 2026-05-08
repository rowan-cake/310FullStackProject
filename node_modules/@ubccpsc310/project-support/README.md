# Project Support

This support library eases development for CPSC 310 students, while allowing course staff to update the library during the term without changing student repositories. 

## Logger

Writing output to `console.log` is not allowed in the project, but the `Log` class exists to provide a mechanism for emitting text to standard out.

```typescript
/**
 * Logging functions
 *
 * These are used to interact with the log without having to
 * directly call into console.log. These prepend messages with 
 * level information and timestamps.
 */
export class Log {
    // Log a message at the trace level
    public static trace(msg: string): void;

    // Log a message at the info level
    public static info(msg: string): void;

    // Log a message at the warn level
    public static warn(msg: string): void;

    // Log a message at the error level
    public static error(msg: string): void;

    // Log a message at the test level
    public static test(msg: string): void;
}
```

## Folder Test

Folder test is a package for dynamically generating batches of tests from external JSON files.

1. Create a directory containing one JSON file for each test you wish to generate. These files must conform to the `FolderTestSchema` described in the [API](#api).
1. Invoke `folderTest` from your test suite.
1. Run your test suite.

### Example

#### Code under test
```typescript
/**
 * Converts a colour in RGB to a number
 * @param rgb An object with r, g, b properties
 * @throws RedError if colour is red
 * @throws YellowError if colour is yellow
 */
function rgbToNum(rgb: { r: number, g: number, b: number }): number {
    const num = (rgb.r << 16) + (rgb.g << 8) + rgb.b;
    if (num === 0xFF000) {
        throw new RedError();
    } else if (num === 0xFFFF00) {
        throw new YellowError();
    } else {
        return num;
    }
}
```

#### Dynamic folder test
```typescript
import { expect } from 'chai'
import {folderTest} from "@ubccpsc310/folder-test";

type Input = { r: number, g: number, b: number };
type Output = number;
type Error = "RedError" | "YellowError";

describe("Dynamic folder test", function () {
    before(function () {
        // Called before any of the tests are run
    });

    beforeEach(function () {
        // Called before each test is run
    });
    
    // Assert value equals expected
    function assertResult(actual: unknown, expected: Output): void {
        expect(actual).to.equal(expected);
    }

    // Assert actual error is of expected type
    function assertError(actual: unknown, expected: Error): void {
        if (expected === "RedError") {
            expect(actual).to.be.an.instanceOf(RedError);
        } else {
            expect(actual).to.be.an.instanceOf(YellowError);
        }
    }

    folderTest<Input, Output, Error>(
        "rgbToNum tests",                               // suiteName
        (input: Input): Output => rgbToNum(input),      // target
        "./test/resources/json-spec",                   // path
        {
            assertOnResult: assertResult,
            assertOnError: assertError,                 // options
        }
    );
});
```

#### ./test/folderTest/resources/json-spec

Assert result
```json
{
  "title": "black",
  "input": {
    "r": 0,
    "g": 0,
    "b": 0
  },
  "errorExpected": false,
  "expected": 0
}
```

Assert error
```json
{
  "title": "yellow",
  "input": {
    "r": 225,
    "g": 225,
    "b": 0
  },
  "errorExpected": true,
  "expected": "YellowError"
}
```

### API
```typescript
/**
 * The main function!
 * @param suiteName - Name of the mocha describe that will be created
 * @param target - A function that invokes the code under test and returns the result
 *          if target returns a promise, it is resolved before the result is passed to `assertOnResult` function
 * @param path - A path where the json schemata are located (includes json schemata in subdirectories)
 * @param options - Described below
 */
function folderTest<I, O, E>(suiteName: string, target: (input: I) => unknown, path: string, options: Options) {
    // ...
}

interface Options {
    // The function that will be called on the result of the code under test
    // if errorExpected is false and the code under test does not throw
    //  if absent, only asserts that the code under test does not throw
    assertOnResult?: (actual: unknown, expected: O, input: I) => void | PromiseLike<void>;

    // The function that will be called on the result of the code under test
    // if errorExpected is true and the code under test throws
    //  if absent, only asserts that the code under test throws
    assertOnError?: (actual: unknown, expected: E, input: I) => void | PromiseLike<void>;

    // Called on the JSON files to ensure that the inputs are "correct" as specified this function
    //  if absent, the inputs are not validated
    inputValidator?: (input: unknown) => input is I;

    // Called on the JSON files to ensure that the outputs are "correct" as specified this function
    //  if absent, the outputs are not validated
    outputValidator?: (output: unknown) => output is O;

    // Called on the JSON files to ensure that the errors are "correct" as specified this function
    //  if absent, the errors are not validated
    errorValidator?: (error: unknown) => error is E;

    // Whether or not to check the JSON for extraneous keys
    // Useful if you are prone to typos
    //  defaults to true
    checkForExcessKeys?: boolean;
}

/**
 * The schema of the JSON that folder-test will read in the provided directory.
 * These files must have the `.json` extension.
 */
interface FolderTestSchema<I, O, E> {
    // The name of the test
    title: string;

    // The input provided to the code under test
    input: I;

    // Whether or not the code under test is expected to throw an error
    //  defaults to false
    errorExpected?: boolean;

    // Whether or not error messages should include results
    //  defaults to false
    verbose?: boolean;

    // The value that code under test must equal
    //  if absent, will only test that the code under test does/doesn't throw an error
    expected?: O | E;
}
```

## Contributing

* To deploy a new version (need to be a part of the `@ubccpsc310` npm organization (https://npmjs.com/settings/ubccpsc310/members)):
    1. Update version number in `package.json`
    2. `npm publish --access public`
