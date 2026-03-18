import { readEnv } from '../utils/reader';
import { DatabaseConfig } from '../interfaces/DatabaseConfig';

/**
 * 환경 변수에서 DatabaseConfig를 파싱합니다.
 * Pool 관리는 features/connection/pool.ts 를 사용하세요.
 *
 * @note 라이브러리는 process.env를 읽기만 합니다.
 *       dotenv.config() 호출은 애플리케이션 진입점에서 직접 하세요:
 *       ```ts
 *       import 'dotenv/config';             // ESM
 *       require('dotenv').config();          // CJS
 *       ```
 */
export function getDatabaseConfig(): DatabaseConfig {
  const env = process.env as Record<string, string | undefined>;
  const connectionString = env.DB_CONNECTION_STRING;

  const config: DatabaseConfig = {
    host:             readEnv<string>(env, 'DB_HOST',     '127.0.0.1'),
    port:             readEnv<number>(env, 'DB_PORT',     5432),
    database:         env.DB_NAME,
    user:             readEnv<string>(env, 'DB_USER',     'postgres'),
    password:         readEnv<string>(env, 'DB_PASSWORD', 'postgres'),
    connectionString,

    ssl: env.DB_SSL !== undefined
      ? readEnv<boolean>(env, 'DB_SSL', false)
      : undefined,

    max:                      env.DB_MAX              ? readEnv<number>(env,  'DB_MAX',              10)    : undefined,
    idleTimeoutMillis:        env.DB_IDLE_TIMEOUT      ? readEnv<number>(env,  'DB_IDLE_TIMEOUT',     30000) : undefined,
    connectionTimeoutMillis:  env.DB_CONNECTION_TIMEOUT ? readEnv<number>(env, 'DB_CONNECTION_TIMEOUT', 2000) : undefined,
    allowExitOnIdle:          readEnv<boolean>(env, 'DB_ALLOW_EXIT_ON_IDLE', false) || undefined,
    statement_timeout:        env.DB_STATEMENT_TIMEOUT  ? readEnv<number>(env, 'DB_STATEMENT_TIMEOUT',  0)   : undefined,
    query_timeout:            env.DB_QUERY_TIMEOUT      ? readEnv<number>(env, 'DB_QUERY_TIMEOUT',      0)   : undefined,
    application_name:         env.DB_APPLICATION_NAME,
    parseInputDatesAsUTC:     readEnv<boolean>(env, 'DB_PARSE_INPUT_DATES_AS_UTC', false) || undefined,
    keepAlive:                readEnv<boolean>(env, 'DB_KEEP_ALIVE', true) || undefined,
    keepAliveInitialDelayMillis: env.DB_KEEP_ALIVE_INITIAL_DELAY
      ? readEnv<number>(env, 'DB_KEEP_ALIVE_INITIAL_DELAY', 10000)
      : undefined,
  };

  if (!config.connectionString && !config.database) {
    throw new Error(
      'DB config error: DB_CONNECTION_STRING 또는 DB_NAME 중 하나는 필수입니다.',
    );
  }

  return config;
}
