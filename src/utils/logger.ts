/**
 * 로그 레벨 타입
 */
export type LogLevel = "debug" | "info" | "log" | "warn" | "error";

/**
 * 로거 설정 인터페이스
 */
export interface LoggerConfig {
    /** 활성화 여부 (기본값: true) */
    enabled?: boolean;
    /** 최소 출력 로그 레벨 (기본값: "info") */
    level?: LogLevel;
    /** ANSI 색상 사용 여부 (기본값: 터미널 지원 여부에 따라 자동) */
    enableColors?: boolean;
    /** 타임스탬프 출력 여부 (기본값: true) */
    enableTimestamp?: boolean;
    /** 로그 prefix (예: "[DB]" 등) */
    prefix?: string;
}

/**
 * ANSI 색상 코드
 */
const Colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
} as const;

/**
 * 로그 레벨 우선순위
 */
const LogLevelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    log: 2,
    warn: 3,
    error: 4,
};

/**
 * 로그 레벨별 색상
 */
const LogLevelColors: Record<LogLevel, string> = {
    debug: Colors.gray,
    info: Colors.cyan,
    log: Colors.white,
    warn: Colors.yellow,
    error: Colors.red,
};

const VALID_LEVELS: LogLevel[] = ["debug", "info", "log", "warn", "error"];

/**
 * 다양한 환경에서 재사용 가능한 Logger 클래스
 *
 * - Node / 브라우저 모두에서 동작 가능
 * - ANSI 색상은 터미널 지원 여부에 따라 자동 활성화
 * - env 또는 설정 객체에서 `enabled`, `level` 등을 주입해서 사용
 */
export class Logger {
    private readonly enabled: boolean;
    private readonly level: LogLevel;
    private readonly enableColors: boolean;
    private readonly enableTimestamp: boolean;
    private readonly prefix?: string;

    constructor(config: LoggerConfig = {}) {
        const nodeProcess = (globalThis as any).process;
        const ttySupportsColor =
            !!nodeProcess && !!nodeProcess.stdout && !!nodeProcess.stdout.isTTY;

        this.enabled = config.enabled ?? true;
        this.level = config.level ?? "info";
        this.enableColors = config.enableColors ?? ttySupportsColor;
        this.enableTimestamp = config.enableTimestamp ?? true;
        this.prefix = config.prefix;
    }

    /**
     * env 객체로부터 Logger 인스턴스를 생성합니다.
     *
     * 지원 키 예시:
     * - LOGGER / LOG_ENABLED: "true" | "1" | "yes" → enabled
     * - LOG_LEVEL: "debug" | "info" | "log" | "warn" | "error"
     */
    static fromEnv(
        env: Record<string, string | undefined>,
        baseConfig: LoggerConfig = {}
    ): Logger {
        const rawEnabled = env.LOGGER ?? env.LOG_ENABLED;
        const rawLevel = env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;

        const enabled =
            rawEnabled !== undefined
                ? ["true", "1", "yes", "on"].includes(rawEnabled.toLowerCase())
                : baseConfig.enabled ?? false;

        const level: LogLevel =
            rawLevel && VALID_LEVELS.includes(rawLevel)
                ? rawLevel
                : baseConfig.level ?? "info";

        return new Logger({
            ...baseConfig,
            enabled,
            level,
        });
    }

    debug(...args: unknown[]): void {
        this.logWithLevel("debug", args);
    }

    info(...args: unknown[]): void {
        this.logWithLevel("info", args);
    }

    log(...args: unknown[]): void {
        this.logWithLevel("log", args);
    }

    warn(...args: unknown[]): void {
        this.logWithLevel("warn", args);
    }

    error(...args: unknown[]): void {
        this.logWithLevel("error", args);
    }

    private shouldLog(level: LogLevel): boolean {
        if (!this.enabled) return false;
        return LogLevelPriority[level] >= LogLevelPriority[this.level];
    }

    private logWithLevel(level: LogLevel, args: unknown[]): void {
        if (!this.shouldLog(level)) return;

        const color = this.enableColors ? LogLevelColors[level] : "";
        const reset = this.enableColors ? Colors.reset : "";

        const timestamp = this.enableTimestamp
            ? new Date().toISOString()
            : undefined;

        const levelLabel = level.toUpperCase();

        let prefixParts: string[] = [];
        if (timestamp) prefixParts.push(timestamp);
        if (this.prefix) prefixParts.push(this.prefix);
        prefixParts.push(levelLabel);

        const prefixStr = prefixParts.join(" ");

        const formattedPrefix = color
            ? `${color}${prefixStr}${reset}`
            : prefixStr;

        const consoleMethod =
            level === "error"
                ? console.error
                : level === "warn"
                    ? console.warn
                    : console.log;

        consoleMethod(formattedPrefix, ...args);
    }
}
