import * as Effect from "effect/Effect";
import fetch from "node-fetch";

import { config } from "./verification-config.js";

export type InvitationEmailError = {
  readonly _tag: "InvitationEmailFailed";
  readonly cause: Error;
};

type SendInvitationParams = {
  readonly email: string;
  readonly token: string;
};

const buildRegisterUrl = (token: string): string =>
  `${config.appUrl}/register?token=${encodeURIComponent(token)}`;

export const sendInvitationEmail = (
  params: SendInvitationParams,
): Effect.Effect<void, InvitationEmailError> =>
  Effect.tryPromise({
    try: () => {
      const registerUrl = buildRegisterUrl(params.token);
      const to = config.emailOverride ?? params.email;
      return fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to,
          subject: "Регистрация по приглашению",
          html: `<p>Вас пригласили зарегистрироваться. Перейдите по ссылке: <a href="${registerUrl}">${registerUrl}</a></p>`,
          text: `Вас пригласили зарегистрироваться: ${registerUrl}`,
        }),
      }).then((response) => {
        if (!response.ok) {
          throw new Error("email_send_failed");
        }
      });
    },
    catch: (cause) => ({
      _tag: "InvitationEmailFailed",
      cause: cause instanceof Error ? cause : new Error(String(cause)),
    }),
  });
