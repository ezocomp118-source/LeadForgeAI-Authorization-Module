import { Effect } from "effect";
import type { FC, ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

import type { CreateInvitationResponse, Filters } from "./admin-types.js";
import { createInvitation, defaultDataLoaders } from "./api.js";
import { FiltersBar } from "./components/FiltersBar.js";
import { InvitationTable } from "./components/InvitationTable.js";
import { type FormState, InviteForm } from "./components/InviteForm.js";
import { LatestCard } from "./components/LatestCard.js";
import { isString } from "./guards.js";
import { useInvitations, useMe } from "./hooks.js";
import type { InvitationView, MeProfile } from "./types.js";
import "./styles.css";

const DEFAULT_FILTERS: Filters = { status: "all", email: "" };

const emptyForm: FormState = {
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  departmentId: "",
  positionId: "",
  expiresInHours: "72",
};

const HeaderBar: FC<{ readonly me: MeProfile | null }> = ({ me }) => (
  <header className="hero">
    <div>
      <h1>Invitations</h1>
      <p>Create and manage registration invites.</p>
    </div>
    <div className="badge">{me ? `Hi, ${me.firstName}` : "Not signed in"}</div>
  </header>
);

const Alerts: FC<{
  readonly meError: string | null;
  readonly invitationsError: string | null;
  readonly submitError: string | null;
}> = ({ meError, invitationsError, submitError }) => (
  <>
    {meError && <div className="alert error">Me load error: {meError}</div>}
    {invitationsError && (
      <div className="alert error">
        Invitations load error: {invitationsError}
      </div>
    )}
    {submitError && <div className="alert error">Create error: {submitError}</div>}
  </>
);

const MainCards: FC<{
  readonly form: FormState;
  readonly onChange: (form: FormState) => void;
  readonly onSubmit: () => void;
  readonly disabled: boolean;
  readonly latest: CreateInvitationResponse | null;
}> = ({ form, onChange, onSubmit, disabled, latest }) => (
  <div className="grid two">
    <InviteForm
      form={form}
      onChange={onChange}
      onSubmit={onSubmit}
      disabled={disabled}
    />
    <LatestCard latest={latest} />
  </div>
);

const ResultBlock: FC<{
  readonly loading: boolean;
  readonly invitations: ReadonlyArray<InvitationView>;
}> = ({ loading, invitations }) =>
  loading ? <div className="card muted">Loading invitations...</div> : <InvitationTable invitations={invitations} />;

const canSubmitForm = (form: FormState): boolean =>
  [
    form.email,
    form.phone,
    form.firstName,
    form.lastName,
    form.departmentId,
    form.positionId,
  ].every((value) => isString(value) && value.trim().length > 0)
  && Number.parseInt(form.expiresInHours, 10) >= 1;

type HandleCreateDeps = {
  readonly me: MeProfile | null;
  readonly form: FormState;
  readonly setSubmitError: (value: string | null) => void;
  readonly setLatest: (value: CreateInvitationResponse | null) => void;
  readonly setForm: (value: FormState) => void;
  readonly reloadInvitations: () => void;
  readonly canSubmit: boolean;
};

const buildHandleCreate = ({
  me,
  form,
  setSubmitError,
  setLatest,
  setForm,
  reloadInvitations,
  canSubmit,
}: HandleCreateDeps): () => void =>
(): void => {
  if (!me) {
    setSubmitError("Требуется авторизация");
    return;
  }
  if (!canSubmit) {
    setSubmitError("Заполните обязательные поля");
    return;
  }
  setSubmitError(null);
  void Effect.runPromise(createInvitation({ form, invitedBy: me.id }))
    .then((result) => {
      if (result._tag === "Success") {
        setLatest(result.data);
        setForm(emptyForm);
        reloadInvitations();
        return;
      }
      setSubmitError(result.error);
    })
    .catch(() => {
      setSubmitError("unexpected_error");
    });
};

type AdminViewModel = {
  readonly filters: Filters;
  readonly setFilters: (next: Filters) => void;
  readonly form: FormState;
  readonly setForm: (next: FormState) => void;
  readonly latest: CreateInvitationResponse | null;
  readonly submitError: string | null;
  readonly me: MeProfile | null;
  readonly meError: string | null;
  readonly invitationsError: string | null;
  readonly invitationsLoading: boolean;
  readonly invitations: ReadonlyArray<InvitationView>;
  readonly canSubmit: boolean;
  readonly handleCreate: () => void;
};

const useAdminView = (): AdminViewModel => {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [latest, setLatest] = useState<CreateInvitationResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: me, error: meError, load: loadMe } = useMe(defaultDataLoaders);
  const {
    data: invitations,
    error: invitationsError,
    reload: reloadInvitations,
    loading: invitationsLoading,
  } = useInvitations(defaultDataLoaders, filters);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    reloadInvitations();
  }, [reloadInvitations]);

  const canSubmit = useMemo(() => canSubmitForm(form), [form]);

  const handleCreate = buildHandleCreate({
    me,
    form,
    setSubmitError,
    setLatest,
    setForm,
    reloadInvitations,
    canSubmit,
  });

  return {
    filters,
    setFilters,
    form,
    setForm,
    latest,
    submitError,
    me,
    meError,
    invitationsError,
    invitationsLoading,
    invitations,
    canSubmit,
    handleCreate,
  };
};

export const AdminInvitationsApp: FC = (): ReactElement => {
  const {
    filters,
    setFilters,
    form,
    setForm,
    latest,
    submitError,
    me,
    meError,
    invitationsError,
    invitationsLoading,
    invitations,
    canSubmit,
    handleCreate,
  } = useAdminView();

  return (
    <main className="layout">
      <HeaderBar me={me} />
      <Alerts
        meError={meError}
        invitationsError={invitationsError}
        submitError={submitError}
      />
      <FiltersBar filters={filters} onChange={setFilters} />
      <MainCards
        form={form}
        onChange={setForm}
        onSubmit={handleCreate}
        disabled={!canSubmit}
        latest={latest}
      />
      <ResultBlock loading={invitationsLoading} invitations={invitations} />
    </main>
  );
};
