import type { FC } from "react";

import type { CreateInvitationResponse } from "../../../src/web/admin-types.js";
import { formatDate } from "../../../src/web/ui.js";

type LatestCardProps = {
	readonly latest: CreateInvitationResponse | null;
};

export const LatestCard: FC<LatestCardProps> = ({ latest }) =>
	latest ? (
		<div className="card stack">
			<h3>Last created</h3>
			<div>Token: {latest.token}</div>
			<div>Expires: {formatDate(latest.expiresAt)}</div>
		</div>
	) : (
		<div className="card muted">No invitation created yet</div>
	);
