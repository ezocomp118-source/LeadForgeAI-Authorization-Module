import type { FC } from "react";

import type { CreateInvitationResponse } from "../admin-types.js";
import { formatDate } from "../ui.js";

type LatestCardProps = {
  readonly latest: CreateInvitationResponse | null;
};

export const LatestCard: FC<LatestCardProps> = ({ latest }) =>
  latest
    ? (
      <div className="card stack">
        <h3>Last created</h3>
        <div>Token: {latest.token}</div>
        <div>Expires: {formatDate(latest.expiresAt)}</div>
      </div>
    )
    : <div className="card muted">No invitation created yet</div>;
