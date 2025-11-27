import "dotenv/config";
import { Resend } from "resend";

type SendResult =
	| { readonly _tag: "Ok"; readonly id: string }
	| { readonly _tag: "Error"; readonly message: string };

const assertEnv = (value: string | undefined, name: string): string => {
	if (!value || value.trim().length === 0) {
		throw new Error(`Missing required env ${name}`);
	}
	return value;
};

const sanitizeEmail = (raw: string): string => raw.trim();

const main = async (): Promise<void> => {
	const apiKey = assertEnv(process.env.RESEND_API_KEY, "RESEND_API_KEY");
	const from = assertEnv(process.env.RESEND_FROM_EMAIL, "RESEND_FROM_EMAIL");
	const to = sanitizeEmail(
		process.env.TEST_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? from,
	);

	const resend = new Resend(apiKey);

	const response = await resend.emails.send({
		from,
		to,
		subject: "Test email from LeadForge Auth",
		text: "Если ты читаешь это письмо, Resend отправка работает.",
	});

	const payload: SendResult = response.error
		? { _tag: "Error", message: response.error.message }
		: { _tag: "Ok", id: response.data?.id ?? "unknown" };

	console.log(JSON.stringify(payload, null, 2));

	if (payload._tag === "Error") {
		throw new Error(payload.message);
	}
};

main().catch((err: unknown) => {
	console.error("Resend test failed:", err);
	process.exit(1);
});
