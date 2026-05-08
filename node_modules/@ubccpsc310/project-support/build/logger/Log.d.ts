/**
 * Collection of logging methods. Useful for making the output easier to read and understand.
 */
export default class Log {
    static trace(...msg: any[]): void;
    static info(...msg: any[]): void;
    static warn(...msg: any[]): void;
    static error(...msg: any[]): void;
    static test(...msg: any[]): void;
}
