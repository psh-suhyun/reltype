import { EnvSource, PostgresDriverOptions } from "../interfaces";

/**
 * 기본 `Record<string, string | undefined>` 형태의 객체에서
 * 환경 변수를 읽어오는 구현체입니다.
 */
export class NodeEnvSource implements EnvSource {
  constructor(private readonly env: Record<string, string | undefined>) { }

  get(key: string): string | undefined {
    return this.env[key];
  }
}

const isEmpty = (v: string) => v.trim() === "";

export function parseString(key: string, value: string): string {
  if (isEmpty(value)) {
    throw new Error(`Empty value provided for ${key}`);
  }
  return value;
}

export function parseNumber(key: string, value: string): number {
  if (isEmpty(value)) {
    throw new Error(`Empty value provided for ${key}`);
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid number value for ${key}: ${value}`);
  }

  return num;
}

export function parseBoolean(key: string, value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (["true", "1"].includes(normalized)) return true;
  if (["false", "0"].includes(normalized)) return false;

  throw new Error(`Invalid boolean value for ${key}: ${value}`);
}

/**
 * `process.env` 와 같은 환경 객체에서 타입까지 안전하게 읽어오는 유틸 함수입니다.
 *
 * 기본값의 타입을 기준으로 파서를 자동 선택합니다.
 * - string  → `parseString`
 * - number  → `parseNumber`
 * - boolean → `parseBoolean`
 */
export function readEnv<T extends string | number | boolean>(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue: T
): T {
  const raw = env[key];

  if (raw === undefined) {
    return defaultValue;
  }

  if (typeof defaultValue === "number") {
    return parseNumber(key, raw) as T;
  }

  if (typeof defaultValue === "boolean") {
    return parseBoolean(key, raw) as T;
  }

  return parseString(key, raw) as T;
}

// ===== Postgres config builder =====

const DB_ENV_KEYS = {
  CONNECTION_STRING: "DB_CONNECTION_STRING",
  HOST: "DB_HOST",
  PORT: "DB_PORT",
  NAME: "DB_NAME",
  USER: "DB_USER",
  PASSWORD: "DB_PASSWORD",
  SSL: "DB_SSL",
  MAX: "DB_MAX",
  IDLE_TIMEOUT: "DB_IDLE_TIMEOUT",
  CONNECTION_TIMEOUT: "DB_CONNECTION_TIMEOUT",
  ALLOW_EXIT_ON_IDLE: "DB_ALLOW_EXIT_ON_IDLE",
  STATEMENT_TIMEOUT: "DB_STATEMENT_TIMEOUT",
  QUERY_TIMEOUT: "DB_QUERY_TIMEOUT",
  APPLICATION_NAME: "DB_APPLICATION_NAME",
  PARSE_INPUT_DATES_AS_UTC: "DB_PARSE_INPUT_DATES_AS_UTC",
  KEEP_ALIVE: "DB_KEEP_ALIVE",
  KEEP_ALIVE_INITIAL_DELAY: "DB_KEEP_ALIVE_INITIAL_DELAY",
} as const;

type DbEnvKey = (typeof DB_ENV_KEYS)[keyof typeof DB_ENV_KEYS];

export class PostgresConfig {
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly user?: string;
  readonly password?: string;
  readonly connectionString?: string;

  readonly ssl?: boolean;
  readonly max?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
  readonly allowExitOnIdle?: boolean;
  readonly statement_timeout?: number;
  readonly query_timeout?: number;
  readonly application_name?: string;
  readonly parseInputDatesAsUTC?: boolean;
  readonly keepAlive?: boolean;
  readonly keepAliveInitialDelayMillis?: number;

  private constructor(options: PostgresDriverOptions) {
    Object.assign(this, options);
    this.validate();
  }

  static fromEnv(source: EnvSource): PostgresConfig {
    const get = (key: DbEnvKey) => source.get(key);

    const getOptionalNumber = (key: DbEnvKey): number | undefined => {
      const raw = get(key);
      return raw !== undefined ? parseNumber(key, raw) : undefined;
    };

    const getOptionalBoolean = (key: DbEnvKey): boolean | undefined => {
      const raw = get(key);
      return raw !== undefined ? parseBoolean(key, raw) : undefined;
    };

    const connectionString = get(DB_ENV_KEYS.CONNECTION_STRING);

    // connectionString 우선 정책
    if (connectionString) {
      return new PostgresConfig({
        connectionString: parseString(DB_ENV_KEYS.CONNECTION_STRING, connectionString),
        ssl: getOptionalBoolean(DB_ENV_KEYS.SSL),
      });
    }

    const database = get(DB_ENV_KEYS.NAME);
    if (!database) {
      throw new Error("DB_NAME is required when DB_CONNECTION_STRING is not set");
    }

    const portRaw = get(DB_ENV_KEYS.PORT);
    if (!portRaw) {
      throw new Error("DB_PORT is required when DB_CONNECTION_STRING is not set");
    }
    return new PostgresConfig({
      host: get(DB_ENV_KEYS.HOST) ?? "127.0.0.1",
      port: get(DB_ENV_KEYS.PORT)
        ? parseNumber(DB_ENV_KEYS.PORT, portRaw)
        : 5432,
      database: parseString(DB_ENV_KEYS.NAME, database),
      user: get(DB_ENV_KEYS.USER) ?? "postgres",
      password: get(DB_ENV_KEYS.PASSWORD) ?? "postgres",

      ssl: getOptionalBoolean(DB_ENV_KEYS.SSL),

      max: getOptionalNumber(DB_ENV_KEYS.MAX),

      idleTimeoutMillis: getOptionalNumber(DB_ENV_KEYS.IDLE_TIMEOUT),

      connectionTimeoutMillis: getOptionalNumber(DB_ENV_KEYS.CONNECTION_TIMEOUT),

      allowExitOnIdle: getOptionalBoolean(DB_ENV_KEYS.ALLOW_EXIT_ON_IDLE),

      statement_timeout: getOptionalNumber(DB_ENV_KEYS.STATEMENT_TIMEOUT),

      query_timeout: getOptionalNumber(DB_ENV_KEYS.QUERY_TIMEOUT),

      application_name: get(DB_ENV_KEYS.APPLICATION_NAME),

      parseInputDatesAsUTC: getOptionalBoolean(DB_ENV_KEYS.PARSE_INPUT_DATES_AS_UTC),

      keepAlive: getOptionalBoolean(DB_ENV_KEYS.KEEP_ALIVE),

      keepAliveInitialDelayMillis: getOptionalNumber(DB_ENV_KEYS.KEEP_ALIVE_INITIAL_DELAY),
    });
  }

  private validate() {
    if (this.port !== undefined) {
      if (this.port <= 0 || this.port > 65535) {
        throw new Error(`Invalid port range: ${this.port}`);
      }
    }

    if (this.max !== undefined && this.max <= 0) {
      throw new Error(`DB_MAX must be greater than 0`);
    }
  }

  toDriverOptions(): PostgresDriverOptions {
    return { ...this };
  }

  toSafeJSON() {
    return {
      ...this,
      password: this.password ? "***" : undefined,
    };
  }
}
