export type ErrorCause = Error | {
    readonly message?: string;
} | string | number | boolean | bigint | symbol | null | undefined;
export type DbError = {
    readonly _tag: "DbError";
    readonly cause: Error;
};
export declare const asDbError: (cause: ErrorCause) => DbError;
