import { useMutation, type UseMutationResult, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Effect, pipe } from "effect";
import { useRef } from "react";

import { apiRequest, queryClient } from "../lib/queryClient.js";

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly profileImageUrl: string | null;
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
}

interface AuthLogContext {
  readonly cookiePresent: boolean;
  readonly unauthorized: boolean;
  readonly renderCount: number;
}

const hasSessionCookie = (): boolean => true;

const logAuthState = (message: string, state: AuthLogContext): void => {
  console.debug("[useAuth]", message, {
    cookiePresent: state.cookiePresent,
    unauthorized: state.unauthorized,
    renderCount: state.renderCount,
  });
};

type UseAuthResult = {
  readonly user: AuthUser | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly error: Error | null;
  readonly logout: () => void;
  readonly isLoggingOut: boolean;
  readonly getDisplayName: () => string;
};

type AuthQueryDeps = {
  readonly hasCookie: boolean;
  readonly unauthorizedRef: { current: boolean };
  readonly renderCountRef: { current: number };
};

const authQueryEffect = (
  deps: AuthQueryDeps,
  signal: AbortSignal,
): Effect.Effect<AuthUser | null, Error> =>
  pipe(
    Effect.tryPromise({
      try: () => fetch("/api/auth/me", { credentials: "include", signal }),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    }),
    Effect.flatMap((res) =>
      res.status === 401
        ? Effect.succeed<AuthUser | null>(null)
        : res.ok
        ? pipe(
          Effect.tryPromise({
            try: () => res.json(),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          }),
          Effect.map((body) => body as AuthUser),
        )
        : pipe(
          Effect.tryPromise({
            try: () => res.text(),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          }),
          Effect.flatMap((text) => Effect.fail(new Error(`${res.status}: ${text || res.statusText}`))),
        )
    ),
    Effect.tap((result) =>
      Effect.sync(() => {
        if (!result) {
          deps.unauthorizedRef.current = true;
          logAuthState("auth fetch empty -> mark unauthorized", {
            cookiePresent: deps.hasCookie,
            unauthorized: deps.unauthorizedRef.current,
            renderCount: deps.renderCountRef.current,
          });
          return;
        }
        logAuthState("auth fetch success", {
          cookiePresent: deps.hasCookie,
          unauthorized: deps.unauthorizedRef.current,
          renderCount: deps.renderCountRef.current,
        });
      })
    ),
  );

const useAuthQuery = (deps: AuthQueryDeps): UseQueryResult<AuthUser | null> =>
  useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    enabled: deps.hasCookie && !deps.unauthorizedRef.current,
    queryFn: ({ signal }) => Effect.runPromise(authQueryEffect(deps, signal)),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: (query) => query.state.data !== null,
    refetchOnReconnect: (query) => query.state.data !== null,
  });

type LogoutMutation = UseMutationResult<Response, Error, void>;

const useLogout = (): LogoutMutation =>
  useMutation<Response>({
    mutationFn: () => Effect.runPromise(apiRequest("POST", "/api/auth/logout")),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/auth-admin";
    },
  });

export const useAuth = (): UseAuthResult => {
  const unauthorizedRef = useRef(false);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const hasCookie = hasSessionCookie();

  logAuthState("auth state", {
    cookiePresent: hasCookie,
    unauthorized: unauthorizedRef.current,
    renderCount: renderCountRef.current,
  });

  const query = useAuthQuery({ hasCookie, unauthorizedRef, renderCountRef });

  logAuthState(
    `query status=${query.status} fetchStatus=${query.fetchStatus} fetching=${query.isFetching}`,
    {
      cookiePresent: hasCookie,
      unauthorized: unauthorizedRef.current,
      renderCount: renderCountRef.current,
    },
  );

  const logout = useLogout();
  const user = query.data ?? null;

  const getDisplayName = (): string => {
    if (!user) return "User";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    if (user.lastName) return user.lastName;
    if (user.email) return user.email;
    return "User";
  };

  return {
    user,
    isLoading: query.isLoading,
    isAuthenticated: user !== null,
    error: query.error ?? null,
    logout: logout.mutate,
    isLoggingOut: logout.isPending,
    getDisplayName,
  };
};
