export interface PostgresDriverOptions {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    connectionString?: string;
    ssl?: boolean;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    allowExitOnIdle?: boolean;
    statement_timeout?: number;
    query_timeout?: number;
    application_name?: string;
    parseInputDatesAsUTC?: boolean;
    keepAlive?: boolean;
    keepAliveInitialDelayMillis?: number;
}