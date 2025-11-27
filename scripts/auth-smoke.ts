import { randomUUID, createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import fetch, { Headers, type RequestInit } from "node-fetch";
import type { AddressInfo } from "node:net";

import { DEVELOPMENT_DATABASE_URL } from "./shared-database-url.js";
import { departments, positions, registrationInvitations, users } from "../src/core/schema/index.js";
import { createApp } from "../src/shell/app.js";
import { db } from "../src/shell/db.js";

type CookieJar = Record<string, string>;

const buildCookieHeader = (jar: CookieJar): string =>
	Object.entries(jar)
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");

const extractCookies = (setCookieHeaders: string[] | undefined, jar: CookieJar) => {
	if (!setCookieHeaders) return;
	for (const header of setCookieHeaders) {
		const [pair] = header.split(";");
		const [name, value] = pair.split("=");
		if (name && value) {
			jar[name] = value;
		}
	}
};

const request = async (
	baseUrl: string,
	path: string,
	options: RequestInit,
	jar: CookieJar
) => {
	const headers = new Headers(options.headers ?? {});
	if (Object.keys(jar).length > 0) {
		headers.set("cookie", buildCookieHeader(jar));
	}
	const res = await fetch(`${baseUrl}${path}`, {
		...options,
		headers
	});
	extractCookies(res.headers.raw()["set-cookie"], jar);
	let body: unknown = null;
	const text = await res.text();
	try {
		body = text.length > 0 ? JSON.parse(text) : null;
	} catch {
		body = text;
	}
	return { status: res.status, body };
};

const ensureAdminUser = async (): Promise<string> => {
	const existing = await db.query.users.findFirst({
		where: (tbl, { eq }) => eq(tbl.email, "admin@example.com")
	});
	if (existing) return existing.id;
	const [admin] = await db
		.insert(users)
		.values({
			email: "admin@example.com",
			firstName: "Admin",
			lastName: "User",
			phone: "+10000000000",
			passwordHash: bcrypt.hashSync("Admin123!", 10)
		})
		.returning();
	return admin.id;
};

const ensureDepartmentAndPosition = async () => {
	const deptCode = "test-dept";
	let department = await db.query.departments.findFirst({
		where: (tbl, { eq }) => eq(tbl.code, deptCode)
	});
	if (!department) {
		[department] = await db
			.insert(departments)
			.values({ code: deptCode, name: "Test Department" })
			.returning();
	}
	let position = await db.query.positions.findFirst({
		where: (tbl, { eq }) => eq(tbl.departmentId, department.id)
	});
	if (!position) {
		[position] = await db
			.insert(positions)
			.values({ departmentId: department.id, title: "Tester" })
			.returning();
	}
	return { departmentId: department.id, positionId: position.id };
};

const insertInvitation = async (adminId: string, departmentId: string, positionId: string) => {
	const token = randomBytes(16).toString("hex");
	const tokenHash = createHash("sha256").update(token).digest("hex");
	const [invite] = await db
		.insert(registrationInvitations)
		.values({
			email: `user.${randomUUID()}@example.com`,
			firstName: "Test",
			lastName: "User",
			phone: "+10000000001",
			departmentId,
			positionId,
			tokenHash,
			invitedBy: adminId,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
		})
		.returning();
	return { token, invite };
};

const extractTokenFromUrl = (devVerifyUrl: string): string => {
	try {
		const url = new URL(devVerifyUrl);
		return url.searchParams.get("token") ?? "";
	} catch {
		return "";
	}
};

const main = async () => {
	process.env["DATABASE_URL"] ??= DEVELOPMENT_DATABASE_URL;
	process.env["SESSION_SECRET"] ??= "test-secret";
	process.env["VERIFICATION_DEV_MODE"] ??= "true";

	const adminId = await ensureAdminUser();
	const org = await ensureDepartmentAndPosition();
	const { token, invite } = await insertInvitation(adminId, org.departmentId, org.positionId);

	const app = createApp();
	const server = app.listen(0);
	const port = (server.address() as AddressInfo).port;
	const baseUrl = `http://127.0.0.1:${port}`;

	const jar: CookieJar = {};

	const registerRes = await request(
		baseUrl,
		"/api/register",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token, password: "User123!Strong" })
		},
		jar
	);

	const meRes = await request(
		baseUrl,
		"/api/auth/me",
		{ method: "GET" },
		jar
	);

	const emailRequestRes = await request(
		baseUrl,
		"/api/auth/email/verify/request",
		{ method: "POST" },
		jar
	);

	const invalidEmailConfirm = await request(
		baseUrl,
		"/api/auth/email/verify/confirm",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token: "invalid-token" })
		},
		jar
	);

	const emailToken = extractTokenFromUrl(
		(emailRequestRes.body as { devVerifyUrl?: string })?.devVerifyUrl ?? ""
	);

	const emailConfirmRes = await request(
		baseUrl,
		"/api/auth/email/verify/confirm",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token: emailToken })
		},
		jar
	);

	const phoneRequestRes = await request(
		baseUrl,
		"/api/auth/phone/verify/request",
		{ method: "POST" },
		jar
	);

	const wrongPhoneConfirm = await request(
		baseUrl,
		"/api/auth/phone/verify/confirm",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code: "000000" })
		},
		jar
	);

	const phoneCode =
		(phoneRequestRes.body as { devCode?: string })?.devCode ?? "";

	const phoneConfirmRes = await request(
		baseUrl,
		"/api/auth/phone/verify/confirm",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code: phoneCode })
		},
		jar
	);

	await request(baseUrl, "/api/auth/logout", { method: "POST" }, jar);

	const loginRes = await request(
		baseUrl,
		"/api/auth/login",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: invite.email, password: "User123!Strong" })
		},
		jar
	);

	server.close();

	console.log(
		JSON.stringify(
			{
				registerRes,
				meRes,
				emailRequestRes,
				invalidEmailConfirm,
				emailConfirmRes,
				phoneRequestRes,
				wrongPhoneConfirm,
				phoneConfirmRes,
				loginRes
			},
			null,
			2
		)
	);
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
