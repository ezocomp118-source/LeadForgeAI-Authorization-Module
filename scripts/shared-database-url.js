// CHANGE: Centralize Neon development database URL for tooling and runtime
// WHY: Keep migrations (drizzle-kit) and dev server aligned to the same datasource without manual exports
// QUOTE(ТЗ): "Используй этот скрипт и везде укажи базу данных"
// REF: REQ-DEV-DATABASE-URL
// PURITY: CORE
// INVARIANT: All local commands default to the same Neon connection string
export const DEVELOPMENT_DATABASE_URL =
	"postgresql://neondb_owner:npg_CLwSE1mYJha5@ep-red-truth-aedljsn0.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";
