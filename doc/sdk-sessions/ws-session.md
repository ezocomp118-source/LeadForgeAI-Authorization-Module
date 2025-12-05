# WebSocket session extraction

- `getSessionUserIdFromRequest(req, { cookieName?, store?, conString?, tableName?, createTableIfMissing? })` — читает `userId` из сессии по cookie (по умолчанию `connect.sid`, поддерживает `s:<sid>.<sig>`).
- Если `store` не передан, можно указать `conString`/`tableName` (по умолчанию `app_sessions`) — будет создан `connect-pg-simple` store; иначе используется переданный store или `MemoryStore`.
- Возвращает `Promise<string | null>` из `session.userId` или `session.passport.user.id`.

## Пример: готовый PG store у хоста
```ts
import session from "express-session";
import connectPg from "connect-pg-simple";
import { getSessionUserIdFromRequest } from "leadforgeai-authorization-module";

const PgStore = connectPg(session);
const store = new PgStore({ conString: process.env.DATABASE_URL, tableName: "app_sessions" });

const userId = await getSessionUserIdFromRequest(req, { store });
```

## Пример: создать store внутри вызова
```ts
import { getSessionUserIdFromRequest } from "leadforgeai-authorization-module";

const userId = await getSessionUserIdFromRequest(req, {
  conString: process.env.DATABASE_URL,
  tableName: "app_sessions",
});
```

## Интеграция
- Хост-приложение само решает доступы/права по projectId; утилита лишь возвращает `userId`.
- Для единого session store/secret в HTTP и WS: навесь `applySession` на Express с тем же `store` и вызывай `getSessionUserIdFromRequest` для апгрейда.
