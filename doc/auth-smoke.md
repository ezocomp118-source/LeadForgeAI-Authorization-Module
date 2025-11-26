# Auth smoke test (manual)

## Что пытался проверить
- Выдача приглашения → регистрация по токену → автологин → logout → повторный login
- Проверка `/api/auth/me` после регистрации
- Проверка полноты схемы под требования регистрации/профиля/кадров: рабочий email/телефон теперь хранятся в `users.work_email/work_phone`, изменения логируются в `employment_change_log`.

## Как запускал
```
export DATABASE_URL=<из scripts/shared-database-url.js>
export SESSION_SECRET=test-secret
npx tsx scripts/auth-smoke.ts
```

## Результат
- Скрипт не смог подключиться к базе (`ECONNREFUSED` на `admin@example.com` select) — доступ к указанному в shared-database-url.js хосту недоступен из окружения.
- HTTP-флоу не проверен, пока БД недоступна.

## Что добавить/поправить
- Убедиться, что БД по `DEVELOPMENT_DATABASE_URL` доступна (Neon/PG open ingress).
- После восстановления доступа переиспользовать `scripts/auth-smoke.ts` (создаёт админа/отдел/позицию, вставляет приглашение, регистрирует пользователя, логинится, дергает `/api/auth/me`).
