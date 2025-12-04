import { QueryClient, type QueryFunction } from "@tanstack/react-query";
import { Effect, pipe } from "effect";

type JsonPrimitive = string | number | boolean | null;
type JsonBody =
  | JsonPrimitive
  | readonly JsonBody[]
  | { readonly [key: string]: JsonBody | undefined };

const buildInit = (method: HttpMethod, data?: JsonBody): RequestInit => {
  const init: RequestInit = {
    method,
    credentials: "include",
  };
  if (data !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(data);
  }
  return init;
};

type HttpMethod = Exclude<RequestInit["method"], undefined>;

const throwIfResNotOk = (res: Response): Effect.Effect<Response, Error> =>
  res.ok
    ? Effect.succeed(res)
    : pipe(
      Effect.tryPromise(() => res.text()),
      Effect.orElseSucceed(() => res.statusText),
      Effect.flatMap((text) => Effect.fail(new Error(`${res.status}: ${text}`))),
    );

// CHANGE: Effect-powered JSON fetcher that always forwards session cookies
// WHY: Auth endpoints rely on HttpOnly sessions; credentials must be present
// QUOTE(TЗ): "apiRequest и getQueryFn с credentials: \"include\""
// REF: user-msg-current
// PURITY: SHELL
// INVARIANT: Session cookies forwarded; non-2xx raise typed Error
export const apiRequest = (
  method: HttpMethod,
  url: string,
  data?: JsonBody,
): Effect.Effect<Response, Error> =>
  pipe(
    Effect.tryPromise(() => fetch(url, buildInit(method, data))),
    Effect.flatMap(throwIfResNotOk),
  );

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn =
  <T>(options: { readonly on401: UnauthorizedBehavior }): QueryFunction<T | null> => ({ queryKey, signal }) =>
    Effect.runPromise(
      pipe(
        Effect.sync(() => (typeof queryKey[0] === "string" ? queryKey[0] : String(queryKey[0]))),
        Effect.flatMap((target) =>
          Effect.tryPromise(() =>
            fetch(target, {
              credentials: "include",
              signal,
            })
          )
        ),
        Effect.flatMap((res) =>
          options.on401 === "returnNull" && res.status === 401
            ? Effect.succeed<T | null>(null)
            : pipe(
              throwIfResNotOk(res),
              Effect.flatMap((okRes) =>
                pipe(
                  Effect.tryPromise(() => okRes.json()),
                  Effect.map((body) => body as T),
                )
              ),
            )
        ),
      ),
    );

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnMount: false,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
