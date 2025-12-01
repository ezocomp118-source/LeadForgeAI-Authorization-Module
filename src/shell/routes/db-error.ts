export type ErrorCause =
  | Error
  | { readonly message?: string }
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type DbError = { readonly _tag: "DbError"; readonly cause: Error };

const hasMessage = (value: ErrorCause): value is { readonly message: string } =>
  typeof value === "object"
  && value !== null
  && "message" in value
  && typeof (value as { readonly message?: string }).message === "string";

const serializeCause = (value: ErrorCause): string => {
  if (
    typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || typeof value === "bigint"
    || typeof value === "symbol"
  ) {
    return String(value);
  }
  const serialized = JSON.stringify(value);
  return typeof serialized === "string" ? serialized : "unknown_error";
};

export const asDbError = (cause: ErrorCause): DbError =>
  cause instanceof Error
    ? { _tag: "DbError", cause }
    : hasMessage(cause)
    ? { _tag: "DbError", cause: new Error(cause.message) }
    : { _tag: "DbError", cause: new Error(serializeCause(cause)) };
