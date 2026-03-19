import { toSnake } from '../transform/case';
import { quoteIdentifier } from '../../utils/sqlGuard';
import { BuiltQuery } from './interfaces/Query';
import { Logger } from '../../utils/logger';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Query]' },
);

/**
 * INSERT 쿼리를 생성합니다. RETURNING * 으로 삽입된 row를 반환합니다.
 * camelCase key → snake_case 컬럼명으로 자동 변환됩니다.
 * 모든 컬럼명은 `quoteIdentifier`로 검증 및 이스케이프됩니다.
 *
 * 삽입할 데이터가 없으면 빈 쿼리를 반환합니다 (실행 시 no-op).
 */
export function buildInsert(
  table: string,
  data: Record<string, unknown>,
): BuiltQuery {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    logger.error(`buildInsert [${table}]: 삽입할 데이터가 없습니다.`);
    return { sql: '', params: [] };
  }

  const cols         = entries.map(([k]) => quoteIdentifier(toSnake(k))).join(', ');
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
  const params       = entries.map(([, v]) => v);

  return {
    sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
    params,
  };
}
