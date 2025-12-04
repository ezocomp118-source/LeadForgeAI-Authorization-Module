import { useMutation } from "@tanstack/react-query";
import { Effect, pipe } from "effect";
import type { FC, FormEvent } from "react";
import { useState } from "react";

import { apiRequest, queryClient } from "../../lib/queryClient.js";
import { type AuthMutationError, describeAuthError } from "./auth-error.js";

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
  readonly submit: (credentials: { readonly email: string; readonly password: string }) => void;
  readonly isPending: boolean;
};

const useLoginMutation = (setFormError: (value: string | null) => void): LoginMutationHandlers => {
  const mutation = useMutation<
    LoginSuccessResponse,
    AuthMutationError,
    { readonly email: string; readonly password: string }
  >({
    mutationFn: (credentials) =>
      Effect.runPromise(
        pipe(
          apiRequest("POST", "/api/auth/login", credentials),
          Effect.flatMap((response) =>
            pipe(
              Effect.tryPromise({
                try: () => response.json(),
                catch: (error) => (error instanceof Error ? error : new Error(String(error))),
              }),
              Effect.map((body) => body as LoginSuccessResponse),
            )
          ),
        ),
      ),
    onSuccess: () => {
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error) => {
      const message = describeAuthError(error, "Invalid email or password");
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
