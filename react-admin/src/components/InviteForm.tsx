import type { ChangeEvent, FC, FormEvent } from "react";

export type FormState = {
	readonly email: string;
	readonly phone: string;
	readonly firstName: string;
	readonly lastName: string;
	readonly departmentId: string;
	readonly positionId: string;
	readonly expiresInHours: string;
};

export type InviteFormProps = {
	readonly form: FormState;
	readonly onChange: (next: FormState) => void;
	readonly onSubmit: () => void;
	readonly disabled: boolean;
};

const FIELDS: ReadonlyArray<{
	readonly key: keyof FormState;
	readonly label: string;
	readonly type?: string;
}> = [
	{ key: "email", label: "Email", type: "email" },
	{ key: "phone", label: "Phone", type: "tel" },
	{ key: "firstName", label: "First name" },
	{ key: "lastName", label: "Last name" },
	{ key: "departmentId", label: "Department ID" },
	{ key: "positionId", label: "Position ID" },
	{ key: "expiresInHours", label: "Expires in hours", type: "number" },
];

export const InviteForm: FC<InviteFormProps> = ({
	form,
	onChange,
	onSubmit,
	disabled,
}) => {
	const update = (key: keyof FormState, value: string) => {
		onChange({ ...form, [key]: value });
	};

	const handler =
		(key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
			update(key, event.target.value);
		};

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		onSubmit();
	};

	return (
		<form className="card" onSubmit={handleSubmit}>
			<h2>Create invite</h2>
			<div className="grid two">
				{FIELDS.map((field) => (
					<label key={field.key} className="stack">
						<span>{field.label}</span>
						<input
							type={field.type ?? "text"}
							required
							min={field.key === "expiresInHours" ? 1 : undefined}
							value={form[field.key]}
							onChange={handler(field.key)}
						/>
					</label>
				))}
			</div>
			<button className="btn-primary" type="submit" disabled={disabled}>
				Create invitation
			</button>
		</form>
	);
};
