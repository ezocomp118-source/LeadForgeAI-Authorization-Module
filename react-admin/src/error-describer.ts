import { match } from "ts-pattern";

import type { ApiError } from "./http.js";

export const describeTransportError = (
  error: ApiError,
): string | null =>
  match<ApiError, string | null>(error)
    .with(
      { _tag: "NetworkError" },
      (err) => `Network error: ${err.reason}`,
    )
    .with(
      { _tag: "DecodeError" },
      (err) => `Response decode failed: ${err.reason}`,
    )
    .with({ _tag: "ApiError" }, () => null)
    .exhaustive();
