import type { ChangeEvent, FC } from "react";

import type { Filters } from "../../../src/web/admin-types.js";

type FiltersProps = {
	readonly filters: Filters;
	readonly onChange: (next: Filters) => void;
};

export const FiltersBar: FC<FiltersProps> = ({ filters, onChange }) => (
	<div className="card stack">
		<h3>Filters</h3>
		<div className="grid two">
			<label className="stack">
				<span>Status</span>
				<select
					value={filters.status}
					onChange={(event: ChangeEvent<HTMLSelectElement>) => {
						onChange({
							...filters,
							status: event.target.value as Filters["status"],
						});
					}}
				>
					<option value="all">All</option>
					<option value="pending">Pending</option>
					<option value="accepted">Accepted</option>
					<option value="expired">Expired</option>
					<option value="revoked">Revoked</option>
				</select>
			</label>
			<label className="stack">
				<span>Email</span>
				<input
					placeholder="search by email"
					value={filters.email}
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						onChange({ ...filters, email: event.target.value });
					}}
				/>
			</label>
		</div>
	</div>
);
