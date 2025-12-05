import session from "express-session";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it } from "vitest";

import { getSessionUserIdFromRequest } from "../src/shell/session-extract.js";

const createRequest = (cookieHeader: string | undefined): IncomingMessage => {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  if (cookieHeader) {
    request.headers.cookie = cookieHeader;
  }
  return request;
};

describe("getSessionUserIdFromRequest", () => {
  it("reads userId from MemoryStore session", async () => {
    const store = new session.MemoryStore();
    await new Promise<void>((resolve) => {
      store.set(
        "sid-plain",
        { cookie: { path: "/" }, userId: "user-123" },
        () => resolve(),
      );
    });

    const userId = await getSessionUserIdFromRequest(
      createRequest(`connect.sid=${encodeURIComponent("sid-plain")}`),
      { store },
    );

    expect(userId).toBe("user-123");
  });

  it("supports signed cookie format", async () => {
    const store = new session.MemoryStore();
    await new Promise<void>((resolve) => {
      store.set(
        "sid-signed",
        { cookie: { path: "/" }, passport: { user: { id: "user-999" } } },
        () => resolve(),
      );
    });

    const encoded = encodeURIComponent("s:sid-signed.signature");
    const userId = await getSessionUserIdFromRequest(
      createRequest(`connect.sid=${encoded}`),
      { store },
    );

    expect(userId).toBe("user-999");
  });

  it("returns null when session missing", async () => {
    const store = new session.MemoryStore();
    const userId = await getSessionUserIdFromRequest(createRequest(undefined), { store });
    expect(userId).toBeNull();
  });
});
