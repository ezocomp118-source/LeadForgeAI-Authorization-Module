import { Effect } from "effect";
import { useState } from "react";

import type { Filters } from "../../src/web/admin-types.js";
import type { InvitationView, MeProfile } from "../../src/web/types.js";
import type { DataLoaders } from "./api.js";

type LoadState<T> = {
	readonly data: T;
	readonly error: string | null;
	readonly loading: boolean;
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

export const useMe = (loaders: DataLoaders) => {
	const [state, setState] = useState<LoadState<MeProfile | null>>(initialMe);

	const load = () => {
		setState((prev) => startLoading(prev));
		void Effect.runPromise(loaders.loadMe()).then((result) => {
			setState((prev) =>
				result._tag === "Success"
					? { ...prev, data: result.data, loading: false, error: null }
					: failure(prev, result.error),
			);
		});
	};

	return { ...state, load };
};

export const useInvitations = (loaders: DataLoaders, filters: Filters) => {
	const [state, setState] =
		useState<LoadState<ReadonlyArray<InvitationView>>>(initialInvites);

	const reload = () => {
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
					: failure(prev, result.error),
			);
		});
	};

	return { ...state, reload };
};
