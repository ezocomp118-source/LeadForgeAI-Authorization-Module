import { Effect } from "effect";
import { useCallback, useState } from "react";

import type { Filters } from "./admin-types.js";
import type { DataLoaders } from "./api.js";
import type { InvitationView, MeProfile } from "./types.js";

type LoadState<T> = {
  readonly data: T;
  readonly error: string | null;
  readonly loading: boolean;
};

type UseMeResult = LoadState<MeProfile | null> & { readonly load: () => void };
type UseInvitationsResult = LoadState<ReadonlyArray<InvitationView>> & {
  readonly reload: () => void;
};

const initialInvites: LoadState<ReadonlyArray<InvitationView>> = {
  data: [],
  error: null,
  loading: false,
};

const initialMe: LoadState<MeProfile | null> = {
  data: null,
  error: null,
  loading: false,
};

const startLoading = <T>(prev: LoadState<T>): LoadState<T> => ({
  ...prev,
  loading: true,
  error: null,
});

const failure = <T>(prev: LoadState<T>, error: string): LoadState<T> => ({
  ...prev,
  loading: false,
  error,
});

export const useMe = (loaders: DataLoaders): UseMeResult => {
  const [state, setState] = useState<LoadState<MeProfile | null>>(initialMe);

  const load = useCallback(() => {
    setState((prev) => startLoading(prev));
    void Effect.runPromise(loaders.loadMe()).then((result) => {
      setState((prev) =>
        result._tag === "Success"
          ? { ...prev, data: result.data, loading: false, error: null }
          : failure(prev, result.error)
      );
    });
  }, [loaders]);

  return { ...state, load };
};

export const useInvitations = (
  loaders: DataLoaders,
  filters: Filters,
): UseInvitationsResult => {
  const [state, setState] = useState<LoadState<ReadonlyArray<InvitationView>>>(initialInvites);

  const reload = useCallback(() => {
    setState((prev) => startLoading(prev));
    void Effect.runPromise(loaders.loadInvitations(filters)).then((result) => {
      setState((prev) =>
        result._tag === "Success"
          ? {
            ...prev,
            data: result.data.invitations,
            loading: false,
            error: null,
          }
          : failure(prev, result.error)
      );
    });
  }, [filters, loaders]);

  return { ...state, reload };
};
