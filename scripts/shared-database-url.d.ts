export declare const DEVELOPMENT_DATABASE_URL: string;
export declare const SHARED_ENV_DEFAULTS: Record<string, string>;
export declare const withSharedEnv: <TEnv extends NodeJS.ProcessEnv>(
	env?: TEnv,
	defaults?: Record<string, string>,
) => Record<string, string> & TEnv;
