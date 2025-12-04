// CHANGE: Centralize auth error typing and messaging for login/register flows
// WHY: Avoid unsafe `any`/`unknown`, keep UI messages aligned with backend error codes
// QUOTE(TЗ): "Ошибки авторизации: ... типы кодов, декодирование и текстовые сообщения."
// REF: user-msg-current
import { match } from "ts-pattern";

export type AuthMutationError = Error | { readonly message?: string } | string;

export type AuthErrorCode =
  | "invalid_payload"
  | "invalid_credentials"
  | "unauthorized"
  | "weak_password"
  | "user_exists"
  | "invitation_not_found_or_expired"
  | "logout_failed"
  | "user_creation_failed";

const authErrorCodes: ReadonlyArray<AuthErrorCode> = [
  "invalid_payload",
  "invalid_credentials",
  "unauthorized",
  "weak_password",
  "user_exists",
  "invitation_not_found_or_expired",
  "logout_failed",
  "user_creation_failed",
];

export const isAuthErrorCode = (value: string): value is AuthErrorCode => authErrorCodes.some((code) => code === value);

const hasMessage = (
  value: AuthMutationError,
): value is Error | { readonly message?: string } => typeof value === "object" && "message" in value;

export const resolveAuthErrorMessage = (
  error: AuthMutationError,
  fallback: string,
): string => {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  if (hasMessage(error) && typeof error.message === "string") {
    return error.message.length > 0 ? error.message : fallback;
  }
  return fallback;
};

export const extractAuthErrorCode = (message: string): AuthErrorCode | null => {
  const trimmed = message.trim();
  if (isAuthErrorCode(trimmed)) {
    return trimmed;
  }
  const braceIndex = trimmed.indexOf("{");
  const candidate = braceIndex >= 0 ? trimmed.slice(braceIndex) : trimmed;
  const parsed = /"error"\s*:\s*"([^"]+)"/.exec(candidate);
  if (parsed?.[1] && isAuthErrorCode(parsed[1])) {
    return parsed[1];
  }
  return null;
};

// CHANGE: Декодируем коды ошибок бэкенда в человекочитаемые сообщения
// WHY: Соблюдаем инвариант информативности: пользователь понимает, почему авторизация не удалась
// QUOTE(ТЗ): "если авторизация не прошла что бы фронтенд это бы сообщал"
// REF: user-msg-current
export const decodeAuthErrorCode = (code: AuthErrorCode | null): string =>
  match<AuthErrorCode | null, string>(code)
    .with("invalid_credentials", () => "Неверная почта или пароль.")
    .with("invalid_payload", () => "Заполните поля корректно.")
    .with("weak_password", () => "Пароль не соответствует политике сложности.")
    .with("user_exists", () => "Пользователь с такой почтой уже существует.")
    .with("invitation_not_found_or_expired", () => "Приглашение не найдено или истекло.")
    .with("unauthorized", () => "Не авторизован. Войдите в систему.")
    .with("logout_failed", () => "Не удалось выйти. Попробуйте снова.")
    .with("user_creation_failed", () => "Не удалось создать пользователя. Повторите попытку.")
    .otherwise(() => "Не удалось выполнить авторизацию.");

export const describeAuthError = (
  error: AuthMutationError,
  fallback: string,
): string => {
  const message = resolveAuthErrorMessage(error, fallback);
  const code = extractAuthErrorCode(message);
  return code ? decodeAuthErrorCode(code) : message;
};
