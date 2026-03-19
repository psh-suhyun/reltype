import { Pool, PoolClient, PoolConfig } from 'pg';
import { Logger } from '../../utils/logger';
import { DbError } from '../../utils/dbError';
import { PostgresConfig, NodeEnvSource } from '../../utils/reader';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Pool]', level: 'info' },
);

/** Pool 상태 스냅샷 */
export interface PoolStatus {
  /** Pool이 초기화되어 있는지 여부 */
  isInitialized: boolean;
  /** 총 생성된 연결 수 */
  totalCount: number;
  /** 현재 유휴 연결 수 */
  idleCount: number;
  /** 연결 대기 중인 요청 수 */
  waitingCount: number;
  /**
   * Pool이 정상 상태인지 여부.
   * - `isInitialized === false` → false
   * - `waitingCount > 0 && idleCount === 0` → false (pool 소진)
   * - 그 외 → true
   */
  isHealthy: boolean;
}

let _pool: Pool | null = null;

/** 설정된 최대 연결 수 (경고 임계값 계산용) */
let _maxConnections = 10;

/**
 * 싱글턴 Pool을 반환합니다.
 *
 * - 최초 호출 시 환경 변수 또는 config로 Pool을 생성합니다.
 * - connectionTimeoutMillis 미설정 시 경고를 출력합니다.
 * - Pool 에러 이벤트를 감지해 로깅합니다.
 */
export function getPool(config?: PoolConfig): Pool {
  if (_pool) return _pool;

  const cfg: PoolConfig =
    config ??
    (PostgresConfig.fromEnv(
      new NodeEnvSource(process.env as Record<string, string | undefined>),
    ).toDriverOptions() as PoolConfig);

  _maxConnections = cfg.max ?? 10;

  if (!cfg.connectionTimeoutMillis) {
    logger.warn(
      'connectionTimeoutMillis 미설정: 연결 획득 시 무한 대기가 발생할 수 있습니다. ' +
      'DB_CONNECTION_TIMEOUT 환경 변수를 설정하세요.',
    );
  }

  _pool = new Pool(cfg);

  _pool.on('error', (err, client) => {
    const dbErr = DbError.from(err);
    logger.error('유휴 클라이언트 오류', {
      ...dbErr.toLogContext(),
      clientPid: (client as unknown as Record<string, unknown>).processID,
    });
  });

  _pool.on('connect', () => {
    const status = readPoolStatus(_pool!);
    logger.debug('새 연결 생성', {
      totalCount:   status.totalCount,
      idleCount:    status.idleCount,
      waitingCount: status.waitingCount,
    });

    if (status.totalCount >= _maxConnections) {
      logger.warn('Pool이 최대 연결 수에 도달했습니다.', {
        totalCount: status.totalCount,
        max:        _maxConnections,
      });
    }
  });

  _pool.on('remove', () => {
    logger.debug('연결 제거됨', { totalCount: _pool?.totalCount ?? 0 });
  });

  logger.info('Pool 생성 완료', {
    max:                     _maxConnections,
    connectionTimeoutMillis: cfg.connectionTimeoutMillis,
    idleTimeoutMillis:       cfg.idleTimeoutMillis,
  });

  return _pool;
}

/**
 * Pool에서 client를 빌려 콜백을 실행한 뒤 자동으로 release합니다.
 *
 * - 연결 획득 실패(연결 수 초과, 타임아웃 등)는 DbError로 변환됩니다.
 * - client는 성공/실패 여부와 무관하게 반드시 release됩니다.
 */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  let client: PoolClient;

  try {
    client = await getPool().connect();
  } catch (err) {
    const dbErr = DbError.from(err);
    logger.error('클라이언트 획득 실패', dbErr.toLogContext());
    throw dbErr;
  }

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * 현재 Pool 상태를 반환합니다.
 * Pool이 생성되지 않았을 경우 모든 값이 0입니다.
 */
export function getPoolStatus(): PoolStatus {
  if (!_pool) {
    return {
      isInitialized: false,
      totalCount:    0,
      idleCount:     0,
      waitingCount:  0,
      isHealthy:     false,
    };
  }
  return readPoolStatus(_pool);
}

/**
 * Pool과 DB 서버 간의 연결이 살아있는지 확인합니다.
 * `SELECT 1` 쿼리를 실행하고 결과를 반환합니다.
 */
export async function checkPoolHealth(): Promise<boolean> {
  try {
    await withClient(async (client) => {
      await client.query('SELECT 1');
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 애플리케이션 종료 시 Pool을 안전하게 닫습니다.
 */
export async function closePool(): Promise<void> {
  if (!_pool) return;
  const p = _pool;
  _pool = null;
  await p.end();
  logger.info('Pool 종료 완료');
}

function readPoolStatus(pool: Pool): PoolStatus {
  const { totalCount, idleCount, waitingCount } = pool;
  return {
    isInitialized: true,
    totalCount,
    idleCount,
    waitingCount,
    // pool이 소진된 경우(대기 요청이 있는데 유휴 연결이 없음)에만 unhealthy
    isHealthy: !(waitingCount > 0 && idleCount === 0),
  };
}
