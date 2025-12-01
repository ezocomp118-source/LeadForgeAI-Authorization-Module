import { Effect } from "effect";
import type { ChangeEvent, FC, FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { isString } from "./guards.js";
import { registerWithInvitation } from "./register-api.js";
import "./styles.css";

type FormState = {
  readonly token: string;
  readonly password: string;
};

type ToastState = { readonly message: string; readonly tone: "success" | "error" };
type ToastControls = {
  readonly toast: ToastState | null;
  readonly push: (message: string, tone: ToastState["tone"]) => void;
};

const readPrefilledToken = (): string => {
  const token = new URLSearchParams(window.location.search).get("token");
  return isString(token) ? token.trim() : "";
};

const redirectAfterSuccess = (): void => {
  window.setTimeout(() => {
    window.location.href = "/";
  }, 900);
};

const useToast = (): ToastControls => {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3200);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const push = (message: string, tone: ToastState["tone"]): void => {
    setToast({ message, tone });
  };

  return { toast, push };
};

const Toast: FC<{ readonly toast: ToastState | null }> = ({ toast }) =>
  toast ? <div className={`toast ${toast.tone}`}>{toast.message}</div> : null;

const RegisterHeader: FC = () => (
  <header className="hero" style={{ marginBottom: 8 }}>
    <div>
      <p className="eyebrow">Authorization Module</p>
      <h1>Complete registration</h1>
      <p className="subtitle">
        Use the invitation token you received to finish onboarding.
      </p>
    </div>
  </header>
);

type RegisterFormController = {
  readonly form: FormState;
  readonly setField: (key: keyof FormState, value: string) => void;
  readonly canSubmit: boolean;
};

const useRegisterFormState = (): RegisterFormController => {
  const [form, setForm] = useState<FormState>({
    token: readPrefilledToken(),
    password: "",
  });

  const canSubmit = useMemo(
    () => form.token.trim().length > 0 && form.password.trim().length > 0,
    [form.password, form.token],
  );

  useEffect(() => {
    const token = readPrefilledToken();
    if (token.length > 0) {
      setForm((prev) => ({ ...prev, token }));
    }
  }, []);

  const setField = useCallback(
    (key: keyof FormState, value: string): void => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { form, setField, canSubmit };
};

type SubmitDeps = {
  readonly form: FormState;
  readonly canSubmit: boolean;
  readonly setSubmitting: (value: boolean) => void;
  readonly setError: (value: string | null) => void;
  readonly setSuccess: (value: string | null) => void;
  readonly push: ToastControls["push"];
};

const buildSubmitHandler = (
  deps: SubmitDeps,
): (event: FormEvent<HTMLFormElement>) => void =>
(event: FormEvent<HTMLFormElement>): void => {
  event.preventDefault();
  if (!deps.canSubmit) {
    deps.setError("Token and password are required.");
    return;
  }
  deps.setSubmitting(true);
  deps.setError(null);
  deps.setSuccess(null);
  void Effect.runPromise(
    registerWithInvitation({
      token: deps.form.token.trim(),
      password: deps.form.password,
    }),
  )
    .then((result) => {
      deps.setSubmitting(false);
      if (result._tag === "Success") {
        deps.setSuccess("Registration successful. Redirecting…");
        deps.push("Registration successful", "success");
        redirectAfterSuccess();
        return;
      }
      deps.setError(result.error);
      deps.push(result.error, "error");
    })
    .catch(() => {
      deps.setSubmitting(false);
      deps.setError("Unexpected error");
      deps.push("Unexpected error", "error");
    });
};

type RegisterViewModel = {
  readonly form: FormState;
  readonly setField: (key: keyof FormState, value: string) => void;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly success: string | null;
  readonly toast: ToastState | null;
  readonly canSubmit: boolean;
  readonly handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const useRegisterView = (): RegisterViewModel => {
  const { form, setField, canSubmit } = useRegisterFormState();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast, push } = useToast();

  const handleSubmit = buildSubmitHandler({
    form,
    canSubmit,
    setSubmitting,
    setError,
    setSuccess,
    push,
  });

  return {
    form,
    setField,
    submitting,
    error,
    success,
    toast,
    canSubmit,
    handleSubmit,
  };
};

type RegisterFormCardProps = {
  readonly form: FormState;
  readonly onChange: (key: keyof FormState, value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly disabled: boolean;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly success: string | null;
};

const RegisterFormCard: FC<RegisterFormCardProps> = ({
  form,
  onChange,
  onSubmit,
  disabled,
  submitting,
  error,
  success,
}) => (
  <form className="card" autoComplete="off" onSubmit={onSubmit}>
    <label className="full">
      <span>Invitation token</span>
      <input
        name="token"
        type="text"
        value={form.token}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("token", event.target.value);
        }}
        required
        placeholder="paste token from invite"
      />
    </label>
    <label className="full">
      <span>Create password</span>
      <input
        name="password"
        type="password"
        value={form.password}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("password", event.target.value);
        }}
        required
        placeholder="Min 12 chars, upper/lower/digit/symbol"
      />
    </label>
    <div className="stack full">
      <button className="btn-primary" type="submit" disabled={disabled}>
        {submitting ? "Registering…" : "Register"}
      </button>
      <span className="muted">
        Tokens from <code>/register?token=</code> links auto-fill above.
      </span>
    </div>
    {error && <div className="error">{error}</div>}
    {success && <div className="success">{success}</div>}
  </form>
);

export const RegisterApp: FC = (): ReactElement => {
  const {
    form,
    setField,
    submitting,
    error,
    success,
    toast,
    canSubmit,
    handleSubmit,
  } = useRegisterView();

  const handleChange = (key: keyof FormState, value: string): void => {
    setField(key, value);
  };

  return (
    <main className="register-page">
      <RegisterHeader />
      <RegisterFormCard
        form={form}
        onChange={handleChange}
        onSubmit={handleSubmit}
        disabled={!canSubmit || submitting}
        submitting={submitting}
        error={error}
        success={success}
      />
      <div className="notice">
        Password policy: at least 12 characters including uppercase, lowercase, digit, and symbol.
      </div>
      <Toast toast={toast} />
    </main>
  );
};
