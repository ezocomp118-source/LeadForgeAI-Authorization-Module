import type { JsonValue } from "./types.js";

type JsonCandidate = JsonValue | FormDataEntryValue | undefined;

export const isRecord = (
  value: JsonValue | undefined,
): value is Record<string, JsonValue> => typeof value === "object" && value !== null;

export const isString = (value: JsonCandidate): value is string => typeof value === "string";

export const isNullableString = (
  value: JsonCandidate,
): value is string | null => value === null || typeof value === "string";

export const isNumber = (value: JsonCandidate): value is number => typeof value === "number" && Number.isFinite(value);
