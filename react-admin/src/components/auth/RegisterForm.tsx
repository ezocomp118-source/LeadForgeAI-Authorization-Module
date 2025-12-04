import { useMutation } from "@tanstack/react-query";
import { Effect, pipe } from "effect";
import type { FC, FormEvent } from "react";
import { useMemo, useState } from "react";

import { apiRequest, queryClient } from "../../lib/queryClient.js";
import { type AuthMutationError, describeAuthError } from "./auth-error.js";
import { FormField } from "./FormField.js";

type RegisterSuccessResponse = {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly profileImageUrl: string | null;
};

type RegisterFormProps = {
  readonly onSwitchToLogin: () => void;
};

type RegistrationPayload = {
  readonly email: string;
  readonly password: string;
  readonly token: string;
  readonly firstName?: string;
  readonly lastName?: string;
};

type RegisterFormState = {
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly inviteToken: string;
};

type RegisterViewProps = {
  readonly form: RegisterFormState;
  readonly formError: string | null;
  readonly isPending: boolean;
  readonly canSubmit: boolean;
  readonly onChange: (key: keyof RegisterFormState, value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onSwitchToLogin: () => void;
};

const RegisterHeader: FC = () => (
  <div>
    <p className="eyebrow">Authorization Module</p>
    <h2>Create account</h2>
    <p className="subtitle">Register with an invitation token</p>
  </div>
);

type FieldsProps = Pick<RegisterViewProps, "form" | "onChange">;

const NameFields: FC<FieldsProps> = ({ form, onChange }) => (
  <div className="grid two">
    <FormField
      label="First name"
      name="firstName"
      type="text"
      value={form.firstName}
      onChange={(value) => {
        onChange("firstName", value);
      }}
      placeholder="John"
      autoComplete="given-name"
    />
    <FormField
      label="Last name"
      name="lastName"
      type="text"
      value={form.lastName}
      onChange={(value) => {
        onChange("lastName", value);
      }}
      placeholder="Doe"
      autoComplete="family-name"
    />
  </div>
);

const ContactFields: FC<FieldsProps> = ({ form, onChange }) => (
  <>
    <FormField
      label="Email *"
      name="email"
      type="email"
      value={form.email}
      onChange={(value) => {
        onChange("email", value);
      }}
      placeholder="email@example.com"
      required
      autoComplete="email"
      className="full"
    />
    <FormField
      label="Invitation token *"
      name="token"
      type="text"
      value={form.inviteToken}
      onChange={(value) => {
        onChange("inviteToken", value);
      }}
      placeholder="Paste token from invitation email"
      required
      autoComplete="one-time-code"
      className="full"
    />
  </>
);

const PasswordFields: FC<FieldsProps> = ({ form, onChange }) => (
  <>
    <FormField
      label="Password *"
      name="password"
      type="password"
      value={form.password}
      onChange={(value) => {
        onChange("password", value);
      }}
      placeholder="••••••••"
      required
      autoComplete="new-password"
      hint="At least 8 characters"
    />
    <FormField
      label="Confirm password *"
      name="confirmPassword"
      type="password"
      value={form.confirmPassword}
      onChange={(value) => {
        onChange("confirmPassword", value);
      }}
      placeholder="••••••••"
      required
      autoComplete="new-password"
    />
  </>
);

const RegisterActions: FC<Pick<RegisterViewProps, "isPending" | "canSubmit" | "onSwitchToLogin" | "formError">> = ({
  isPending,
  canSubmit,
  onSwitchToLogin,
  formError,
}) => (
  <>
    <div className="stack full">
      <button className="btn-primary" type="submit" disabled={isPending || !canSubmit}>
        {isPending ? "Creating account…" : "Create account"}
      </button>
      <button className="btn-ghost" type="button" onClick={onSwitchToLogin}>
        Already have an account? Login
      </button>
    </div>
    {formError ? <div className="error full">{formError}</div> : null}
  </>
);

const RegisterFields: FC<RegisterViewProps> = (
  { form, formError, isPending, canSubmit, onChange, onSubmit, onSwitchToLogin },
) => (
  <form onSubmit={onSubmit} autoComplete="on">
    <NameFields form={form} onChange={onChange} />
    <ContactFields form={form} onChange={onChange} />
    <PasswordFields form={form} onChange={onChange} />
    <RegisterActions
      isPending={isPending}
      canSubmit={canSubmit}
      onSwitchToLogin={onSwitchToLogin}
      formError={formError}
    />
  </form>
);

const RegisterFormView: FC<RegisterViewProps> = (props) => (
  <div className="card">
    <div className="card__header">
      <RegisterHeader />
    </div>
    <RegisterFields {...props} />
  </div>
);

type RegisterMutationHandlers = {
  readonly submit: (payload: RegistrationPayload) => void;
  readonly isPending: boolean;
};

const useRegisterMutation = (setFormError: (value: string | null) => void): RegisterMutationHandlers => {
  const mutation = useMutation<RegisterSuccessResponse, AuthMutationError, RegistrationPayload>({
    mutationFn: (payload) =>
      Effect.runPromise(
        pipe(
          apiRequest("POST", "/api/auth/register", payload),
          Effect.flatMap((response) =>
            pipe(
              Effect.tryPromise({
                try: () => response.json(),
                catch: (error) => (error instanceof Error ? error : new Error(String(error))),
              }),
              Effect.map((body) => body as RegisterSuccessResponse),
            )
          ),
        ),
      ),
    onSuccess: () => {
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.href = "/auth-admin";
    },
    onError: (error) => {
      const message = describeAuthError(error, "Failed to create account");
      setFormError(message);
    },
  });

  return { submit: mutation.mutate, isPending: mutation.isPending };
};

const buildRegistrationPayload = (
  form: RegisterFormState,
  setFormError: (value: string | null) => void,
): RegistrationPayload | null => {
  if (form.password !== form.confirmPassword) {
    setFormError("Passwords do not match");
    return null;
  }
  if (form.password.length < 8) {
    setFormError("Password must be at least 8 characters");
    return null;
  }
  const base: RegistrationPayload = {
    email: form.email.trim(),
    password: form.password,
    token: form.inviteToken.trim(),
  };
  const withFirst = form.firstName.trim().length > 0 ? { firstName: form.firstName.trim() } : {};
  const withLast = form.lastName.trim().length > 0 ? { lastName: form.lastName.trim() } : {};
  return { ...base, ...withFirst, ...withLast };
};

const useRegisterController = (onSwitchToLogin: () => void): RegisterViewProps => {
  const [form, setForm] = useState<RegisterFormState>({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    inviteToken: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { submit, isPending } = useRegisterMutation(setFormError);

  const canSubmit = useMemo(
    () =>
      form.email.trim().length > 0
      && form.password.trim().length > 0
      && form.confirmPassword.trim().length > 0
      && form.inviteToken.trim().length > 0,
    [form],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmit) {
      setFormError("Заполните все обязательные поля");
      return;
    }
    const payload = buildRegistrationPayload(form, setFormError);
    if (!payload) {
      return;
    }
    setFormError(null);
    submit(payload);
  };

  const onChange = (key: keyof RegisterFormState, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return {
    form,
    formError,
    isPending,
    canSubmit,
    onChange,
    onSubmit,
    onSwitchToLogin,
  };
};

export const RegisterForm: FC<RegisterFormProps> = ({ onSwitchToLogin }) => (
  <RegisterFormView {...useRegisterController(onSwitchToLogin)} />
);
