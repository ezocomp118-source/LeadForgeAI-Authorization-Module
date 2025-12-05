declare module "connect-pg-simple" {
  import type session from "express-session";

  type PgStoreOptions = {
    readonly conString?: string;
    readonly tableName?: string;
    readonly createTableIfMissing?: boolean;
  };

  type PgStoreConstructor = new(options?: PgStoreOptions) => session.Store;

  const connectPg: (sessionModule: typeof session) => PgStoreConstructor;
  export default connectPg;
}
