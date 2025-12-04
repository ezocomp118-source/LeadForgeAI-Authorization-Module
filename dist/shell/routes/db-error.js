const hasMessage = (value) => typeof value === "object"
    && value !== null
    && "message" in value
    && typeof value.message === "string";
const serializeCause = (value) => {
    if (typeof value === "string"
        || typeof value === "number"
        || typeof value === "boolean"
        || typeof value === "bigint"
        || typeof value === "symbol") {
        return String(value);
    }
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized : "unknown_error";
};
export const asDbError = (cause) => cause instanceof Error
    ? { _tag: "DbError", cause }
    : hasMessage(cause)
        ? { _tag: "DbError", cause: new Error(cause.message) }
        : { _tag: "DbError", cause: new Error(serializeCause(cause)) };
