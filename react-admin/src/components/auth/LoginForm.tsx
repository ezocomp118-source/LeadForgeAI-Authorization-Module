import { useMutation } from "@tanstack/react-query";
import { Effect, pipe } from "effect";
import type { FC, FormEvent } from "react";
import { useState } from "react";
import { match, P } from "ts-pattern";

import { queryClient } from "../../lib/queryClient.js";
import { type AuthMutationError, decodeAuthErrorCode, describeAuthError, isAuthErrorCode } from "./auth-error.js";

type LoginSuccessResponse = {
  readonly id: string;
  readonly email: string;
};

type LoginFormProps = {
  readonly onSwitchToRegister: () => void;
};

type LoginViewState = {
  readonly email: string;
  readonly password: string;
  readonly formError: string | null;
  readonly isPending: boolean;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onSwitchToRegister: () => void;
};

type Credentials = { readonly email: string; readonly password: string };

type LoginError =
  | { readonly _tag: "HttpError"; readonly status: number; readonly code: string | null }
  | { readonly _tag: "NetworkError"; readonly reason: string }
  | { readonly _tag: "DecodeError"; readonly reason: string };

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type ErrorCause =
  | Error
  | { readonly message?: string }
  | string
  | number
  | boolean
  | symbol
  | bigint
  | null
  | undefined;

type MessageCarrier = { readonly message?: string };

const hasMessage = (value: MessageCarrier | null): value is { readonly message: string } =>
  value !== null && typeof value.message === "string";

const inferMessage = (cause: Exclude<ErrorCause, Error>): string =>
  match(cause)
    .with(P.string, (value) => value)
    .with(P.union(P.number, P.boolean, P.bigint), (value) => `${value}`)
    .with(P.symbol, (value) => value.description ?? "unknown_error")
    .with(
      P.when(
        (value): value is { readonly message: string } =>
          hasMessage(typeof value === "object" && value !== null ? (value as MessageCarrier) : null),
      ),
      (value) => value.message,
    )
    .otherwise(() => "unknown_error");

const toError = (cause: ErrorCause): Error => cause instanceof Error ? cause : new Error(inferMessage(cause));

const parseErrorCode = (body: JsonValue): string | null => {
  if (
    typeof body === "object"
    && body !== null
    && "error" in body
    && typeof (body as { readonly error?: string | null }).error === "string"
  ) {
    return (body as { readonly error: string }).error;
  }
  return null;
};

const performLogin = (
  credentials: Credentials,
): Effect.Effect<LoginSuccessResponse, LoginError> =>
  pipe(
    Effect.tryPromise(() =>
      fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      })
    ),
    Effect.mapError((error) => ({ _tag: "NetworkError", reason: toError(error as ErrorCause).message } as LoginError)),
    Effect.flatMap((response) =>
      response.ok
        ? pipe(
          Effect.tryPromise<LoginSuccessResponse>(() => response.json()),
          Effect.mapError((
            error,
          ) => ({ _tag: "DecodeError", reason: toError(error as ErrorCause).message } as LoginError)),
          Effect.map((body) => body),
        )
        : pipe(
          Effect.tryPromise<JsonValue>(() => response.json()),
          Effect.mapError((
            error,
          ) => ({ _tag: "DecodeError", reason: toError(error as ErrorCause).message } as LoginError)),
          Effect.flatMap((body) =>
            Effect.fail<LoginError>({
              _tag: "HttpError",
              status: response.status,
              code: parseErrorCode(body),
            })
          ),
        )
    ),
  );

const LoginHeader: FC = () => (
  <div>
    <p className="eyebrow">Authorization Module</p>
    <h2>Login</h2>
    <p className="subtitle">Sign in to manage invitations</p>
  </div>
);

const LoginFields: FC<LoginViewState> = ({
  email,
  password,
  formError,
  isPending,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onSwitchToRegister,
}) => (
  <form onSubmit={onSubmit} autoComplete="on">
    <label className="full">
      <span>Email</span>
      <input
        name="email"
        type="email"
        value={email}
        onChange={(event) => {
          onEmailChange(event.target.value);
        }}
        required
        placeholder="email@example.com"
        autoComplete="email"
      />
    </label>
    <label className="full">
      <span>Password</span>
      <input
        name="password"
        type="password"
        value={password}
        onChange={(event) => {
          onPasswordChange(event.target.value);
        }}
        required
        placeholder="••••••••"
        autoComplete="current-password"
      />
    </label>
    <div className="stack full">
      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? "Logging in…" : "Login"}
      </button>
      <button className="btn-ghost" type="button" onClick={onSwitchToRegister}>
        Need an account? Register
      </button>
    </div>
    {formError ? <div className="error full">{formError}</div> : null}
  </form>
);

const LoginFormView: FC<LoginViewState> = (props) => (
  <div className="card">
    <div className="card__header">
      <LoginHeader />
    </div>
    <LoginFields {...props} />
  </div>
);

type LoginMutationHandlers = {
  readonly submit: (credentials: Credentials) => void;
  readonly isPending: boolean;
};

const resolveLoginError = (error: LoginError | AuthMutationError): string =>
  match<LoginError | AuthMutationError, string>(error)
    .with({ _tag: "HttpError" }, (err) => decodeAuthErrorCode(err.code && isAuthErrorCode(err.code) ? err.code : null))
    .with({ _tag: "NetworkError" }, (err) => err.reason)
    .with({ _tag: "DecodeError" }, (err) => err.reason)
    .otherwise((err) => describeAuthError(err, "Invalid email or password"));

const useLoginMutation = (setFormError: (value: string | null) => void): LoginMutationHandlers => {
  const mutation = useMutation<LoginSuccessResponse, LoginError | AuthMutationError, Credentials>({
    mutationFn: (credentials) => Effect.runPromise(performLogin(credentials)),
    onSuccess: () => {
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error) => {
      const message = resolveLoginError(error);
      setFormError(message);
    },
  });

  return { submit: mutation.mutate, isPending: mutation.isPending };
};

const useLoginController = (onSwitchToRegister: () => void): LoginViewState => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { submit, isPending } = useLoginMutation(setFormError);

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setFormError("Введите почту и пароль");
      return;
    }
    submit({ email, password });
  };

  return {
    email,
    password,
    formError,
    isPending,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onSubmit,
    onSwitchToRegister,
  };
};

export const LoginForm: FC<LoginFormProps> = ({ onSwitchToRegister }) => (
  <LoginFormView {...useLoginController(onSwitchToRegister)} />
);
