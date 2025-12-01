import type { FC } from "react";

import type { InvitationView } from "../types.js";
import { formatDate } from "../ui.js";

type InvitationTableProps = {
  readonly invitations: ReadonlyArray<InvitationView>;
};

export const InvitationTable: FC<InvitationTableProps> = ({ invitations }) => (
  <div className="card">
    <h3>Invitations</h3>
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Department</th>
            <th>Position</th>
            <th>Status</th>
            <th>Expires</th>
            <th>Created</th>
            <th>Accepted</th>
            <th>Invited by</th>
            <th>Token</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((invite) => (
            <tr key={invite.id}>
              <td>{invite.email}</td>
              <td>
                {invite.firstName} {invite.lastName}
              </td>
              <td>{invite.department ?? "—"}</td>
              <td>{invite.position ?? "—"}</td>
              <td>{invite.status}</td>
              <td>{invite.expiresAt ? formatDate(invite.expiresAt) : "—"}</td>
              <td>{invite.createdAt ? formatDate(invite.createdAt) : "—"}</td>
              <td>{invite.acceptedAt ? formatDate(invite.acceptedAt) : "—"}</td>
              <td>{invite.invitedBy}</td>
              <td>{invite.token ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
