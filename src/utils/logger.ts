export type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';

/** 로그 출력 포맷 */
export type LogFormat = 'text' | 'json';

export interface LoggerConfig {
  /** 로거 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /** 최소 출력 로그 레벨 (기본값: "info") */
  level?: LogLevel;
  /** 출력 포맷 — text: 컬러 텍스트, json: 구조화된 JSON (기본값: "text") */
  format?: LogFormat;
  /** ANSI 색상 사용 여부 (format=text 일 때만 적용, 기본값: TTY 지원 여부) */
  enableColors?: boolean;
  /** 타임스탬프 출력 여부 (기본값: true) */
  enableTimestamp?: boolean;
  /** 로그 prefix (예: "[Pool]", "[Repo]") */
  prefix?: string;
}

const ANSI = {
  reset:   '\x1b[0m',
  gray:    '\x1b[90m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
} as const;

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: ANSI.gray,
  info:  ANSI.cyan,
  log:   ANSI.white,
  warn:  ANSI.yellow,
  error: ANSI.red,
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  log:   2,
  warn:  3,
  error: 4,
};

const VALID_LEVELS: LogLevel[] = ['debug', 'info', 'log', 'warn', 'error'];

/** JSON 포맷으로 출력할 구조화된 로그 엔트리 */
interface LogEntry {
  ts:      string;
  level:   string;
  prefix?: string;
  msg:     string;
  meta?:   unknown[];
}

/**
 * 범용 Logger 클래스.
 *
 * - format='text' : ANSI 컬러 텍스트 (개발 환경)
 * - format='json' : 구조화된 JSON 한 줄 출력 (프로덕션 / 로그 수집기 연동)
 *
 * @example
 * ```ts
 * // 텍스트 포맷 (개발)
 * const logger = new Logger({ prefix: '[DB]', level: 'debug' });
 *
 * // JSON 포맷 (프로덕션)
 * const logger = new Logger({ prefix: '[DB]', format: 'json' });
 *
 * // env 기반 자동 설정
 * const logger = Logger.fromEnv(process.env, { prefix: '[DB]' });
 * ```
 */
export class Logger {
  private readonly enabled: boolean;
  private readonly level: LogLevel;
  private readonly format: LogFormat;
  private readonly enableColors: boolean;
  private readonly enableTimestamp: boolean;
  private readonly prefix?: string;

  constructor(config: LoggerConfig = {}) {
    const nodeProcess = (globalThis as Record<string, unknown>).process as
      { stdout?: { isTTY?: boolean } } | undefined;
    const ttySupportsColor = !!nodeProcess?.stdout?.isTTY;

    this.enabled          = config.enabled          ?? true;
    this.level            = config.level            ?? 'info';
    this.format           = config.format           ?? 'text';
    this.enableColors     = config.enableColors     ?? ttySupportsColor;
    this.enableTimestamp  = config.enableTimestamp  ?? true;
    this.prefix           = config.prefix;
  }

  /**
   * 환경 변수에서 Logger 인스턴스를 생성합니다.
   *
   * 지원 환경 변수:
   * - LOGGER / LOG_ENABLED: "true" | "1" | "yes" | "on"
   * - LOG_LEVEL: "debug" | "info" | "log" | "warn" | "error"
   * - LOG_FORMAT: "text" | "json"
   */
  static fromEnv(
    env: Record<string, string | undefined>,
    baseConfig: LoggerConfig = {},
  ): Logger {
    const rawEnabled = env.LOGGER ?? env.LOG_ENABLED;
    const rawLevel   = env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
    const rawFormat  = env.LOG_FORMAT?.toLowerCase() as LogFormat | undefined;

    const enabled =
      rawEnabled !== undefined
        ? ['true', '1', 'yes', 'on'].includes(rawEnabled.toLowerCase())
        : baseConfig.enabled ?? false;

    const level: LogLevel =
      rawLevel && VALID_LEVELS.includes(rawLevel)
        ? rawLevel
        : baseConfig.level ?? 'info';

    const format: LogFormat =
      rawFormat === 'json' ? 'json' : baseConfig.format ?? 'text';

    return new Logger({ ...baseConfig, enabled, level, format });
  }

  debug(...args: unknown[]): void { this.emit('debug', args); }
  info(...args: unknown[]): void  { this.emit('info',  args); }
  log(...args: unknown[]): void   { this.emit('log',   args); }
  warn(...args: unknown[]): void  { this.emit('warn',  args); }
  error(...args: unknown[]): void { this.emit('error', args); }

  private shouldEmit(level: LogLevel): boolean {
    return this.enabled && LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  private emit(level: LogLevel, args: unknown[]): void {
    if (!this.shouldEmit(level)) return;

    if (this.format === 'json') {
      this.emitJson(level, args);
    } else {
      this.emitText(level, args);
    }
  }

  private emitJson(level: LogLevel, args: unknown[]): void {
    const [first, ...rest] = args;
    const msg  = typeof first === 'string' ? first : JSON.stringify(first);
    const meta = rest.length > 0 ? rest : undefined;

    const entry: LogEntry = {
      ts:     new Date().toISOString(),
      level:  level.toUpperCase(),
      msg,
      ...(this.prefix && { prefix: this.prefix }),
      ...(meta        && { meta }),
    };

    const output = JSON.stringify(entry);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  private emitText(level: LogLevel, args: unknown[]): void {
    const color = this.enableColors ? LEVEL_COLOR[level] : '';
    const reset = this.enableColors ? ANSI.reset : '';

    const parts: string[] = [];
    if (this.enableTimestamp) parts.push(new Date().toISOString());
    if (this.prefix)          parts.push(this.prefix);
    parts.push(level.toUpperCase());

    const prefixStr = color ? `${color}${parts.join(' ')}${reset}` : parts.join(' ');

    if (level === 'error') {
      console.error(prefixStr, ...args);
    } else if (level === 'warn') {
      console.warn(prefixStr, ...args);
    } else {
      console.log(prefixStr, ...args);
    }
  }
}
