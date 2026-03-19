import { toSnake } from '../transform/case';
import { quoteIdentifier } from '../../utils/sqlGuard';
import { BuiltQuery } from './interfaces/Query';
import { Logger } from '../../utils/logger';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Query]' },
);

/**
 * 여러 row를 한 번의 INSERT 쿼리로 삽입합니다.
 * 모든 컬럼명은 `quoteIdentifier`로 검증 및 이스케이프됩니다.
 *
 * @param table - 테이블명
 * @param rows  - 삽입할 데이터 배열 (camelCase key)
 *               모든 row가 동일한 key 구조를 가져야 합니다.
 *               첫 번째 row의 key 목록을 기준으로 컬럼을 결정합니다.
 *
 * rows가 빈 배열이거나 첫 row의 데이터가 없으면 빈 쿼리를 반환합니다 (실행 시 no-op).
 */
export function buildBulkInsert(
  table: string,
  rows: Record<string, unknown>[],
): BuiltQuery {
  if (rows.length === 0) {
    logger.error(`buildBulkInsert [${table}]: 삽입할 row가 없습니다.`);
    return { sql: '', params: [] };
  }

  const keys = Object.keys(rows[0]).filter((k) => rows[0][k] !== undefined);

  if (keys.length === 0) {
    logger.error(`buildBulkInsert [${table}]: 첫 번째 row에 삽입할 데이터가 없습니다.`);
    return { sql: '', params: [] };
  }

  const cols   = keys.map((k) => quoteIdentifier(toSnake(k))).join(', ');
  const params: unknown[] = [];

  const valueSets = rows.map((row) => {
    const placeholders = keys.map((k) => {
      params.push(row[k] ?? null);
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  return {
    sql: `INSERT INTO ${table} (${cols}) VALUES ${valueSets.join(', ')} RETURNING *`,
    params,
  };
}
