import dotenv from "dotenv";
import { Pool, PoolClient, PoolConfig } from "pg";
import { readEnv } from "../utils/reader";
import { DatabaseConfig } from "../interfaces/DatabaseConfig";
import { Logger } from "../utils/logger";

dotenv.config();

/** env 기반 DB 전용 로거 (LOGGER=true 시 활성화) */
const logger = Logger.fromEnv(process.env as Record<string, string | undefined>, {
    prefix: "[DB]",
    level: "info",
});

/**
 * 환경 변수에서 데이터베이스 설정을 읽어옵니다.
 * PostgreSQL의 주요 설정 옵션을 타입 안전하게 파싱합니다.
 */
export function getDatabaseConfig(): DatabaseConfig {
    const env = process.env as Record<string, string | undefined>;

    const connectionString = env.DB_CONNECTION_STRING;

    const config: DatabaseConfig = {
        // 기본 연결 설정
        host: readEnv<string>(env, "DB_HOST", "127.0.0.1"),
        port: readEnv<number>(env, "DB_PORT", 5432),
        database: env.DB_NAME,
        user: readEnv<string>(env, "DB_USER", "postgres"),
        password: readEnv<string>(env, "DB_PASSWORD", "postgres"),
        connectionString,

        // SSL 설정
        ssl:
            env.DB_SSL !== undefined
                ? readEnv<boolean>(env, "DB_SSL", false)
                : undefined,

        // 연결 풀 설정
        max: env.DB_MAX ? readEnv<number>(env, "DB_MAX", 10) : undefined,
        idleTimeoutMillis: env.DB_IDLE_TIMEOUT
            ? readEnv<number>(env, "DB_IDLE_TIMEOUT", 30000)
            : undefined,
        connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT
            ? readEnv<number>(env, "DB_CONNECTION_TIMEOUT", 2000)
            : undefined,
        allowExitOnIdle:
            readEnv<boolean>(env, "DB_ALLOW_EXIT_ON_IDLE", false) || undefined,

        // 타임아웃 설정
        statement_timeout: env.DB_STATEMENT_TIMEOUT
            ? readEnv<number>(env, "DB_STATEMENT_TIMEOUT", 0)
            : undefined,
        query_timeout: env.DB_QUERY_TIMEOUT
            ? readEnv<number>(env, "DB_QUERY_TIMEOUT", 0)
            : undefined,

        // 애플리케이션 설정
        application_name: env.DB_APPLICATION_NAME,

        // 날짜 파싱 설정
        parseInputDatesAsUTC:
            readEnv<boolean>(env, "DB_PARSE_INPUT_DATES_AS_UTC", false) || undefined,

        // Keep-Alive 설정
        keepAlive: readEnv<boolean>(env, "DB_KEEP_ALIVE", true) || undefined,
        keepAliveInitialDelayMillis: env.DB_KEEP_ALIVE_INITIAL_DELAY
            ? readEnv<number>(env, "DB_KEEP_ALIVE_INITIAL_DELAY", 10000)
            : undefined,
    };

    // 최소 설정 유효성 검사: connectionString 또는 DB_NAME 둘 중 하나는 필수
    if (!config.connectionString && !config.database) {
        throw new Error(
            "Database configuration error: either DB_CONNECTION_STRING or DB_NAME must be set."
        );
    }

    return config;
}

/**
 * 애플리케이션 전체에서 재사용되는 PostgreSQL 연결 풀을 반환합니다.
 *
 * - 내부적으로 싱글턴 패턴을 사용하여 Pool 인스턴스를 한 번만 생성합니다.
 * - 이를 통해 'too many connections' 문제를 방지하고,
 *   요청마다 새로운 연결을 만드는 실수를 피할 수 있습니다.
 */
let sharedPool: Pool | null = null;

export function getDatabasePool(): Pool {
    if (sharedPool) {
        return sharedPool;
    }

    const config = getDatabaseConfig();

    // PoolConfig와 대부분 호환되는 형태이므로 그대로 전달합니다.
    sharedPool = new Pool(config as PoolConfig);

    sharedPool.on("error", (err) => {
        logger.error("Unexpected error on idle PostgreSQL client", err);
    });

    logger.info("Pool created");
    return sharedPool;
}

/**
 * 풀에서 클라이언트를 하나 획득합니다.
 * 사용이 끝나면 반드시 `client.release()`를 호출해야 합니다.
 */
export async function connectDatabase(): Promise<PoolClient> {
    const pool = getDatabasePool();
    logger.debug("Acquiring client from pool");
    const client = await pool.connect();
    logger.debug("Client acquired");
    return client;
}

/**
 * 클라이언트를 안전하게 빌려 쓰고 자동으로 release 해주는 헬퍼입니다.
 *
 * ```ts
 * await withDatabaseClient(async (client) => {
 *   const result = await client.query("SELECT 1");
 * });
 * ```
 */
export async function withDatabaseClient<T>(
    fn: (client: PoolClient) => Promise<T>
): Promise<T> {
    const client = await connectDatabase();
    try {
        return await fn(client);
    } finally {
        client.release();
    }
}

/**
 * 애플리케이션 종료 시점 등에 풀을 종료합니다.
 * 더 이상 DB를 사용하지 않을 때 호출해야 합니다.
 */
export async function closeDatabasePool(): Promise<void> {
    if (!sharedPool) {
        logger.debug("closeDatabasePool: no pool to close");
        return;
    }

    const pool = sharedPool;
    sharedPool = null;

    await pool.end();
    logger.info("Pool closed");
}