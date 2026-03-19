import { toSnake } from '../transform/case';
import { quoteIdentifier } from '../../utils/sqlGuard';
import { BuiltQuery } from './interfaces/Query';
import { Logger } from '../../utils/logger';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Query]' },
);

/**
 * INSERT ... ON CONFLICT DO UPDATE 쿼리를 생성합니다.
 * 충돌 컬럼을 제외한 나머지 컬럼을 EXCLUDED 값으로 업데이트합니다.
 * 모든 컬럼명은 `quoteIdentifier`로 검증 및 이스케이프됩니다.
 *
 * @param table       - 테이블명
 * @param data        - 삽입할 데이터 (camelCase key)
 * @param conflictCol - 충돌 기준 컬럼명 (snake_case)
 *
 * 삽입할 데이터가 없으면 빈 쿼리를 반환합니다 (실행 시 no-op).
 */
export function buildUpsert(
  table: string,
  data: Record<string, unknown>,
  conflictCol: string,
): BuiltQuery {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    logger.error(`buildUpsert [${table}]: 삽입할 데이터가 없습니다.`);
    return { sql: '', params: [] };
  }

  const quotedConflictCol = quoteIdentifier(conflictCol);
  const snakeCols         = entries.map(([k]) => toSnake(k));
  const cols              = snakeCols.map(quoteIdentifier).join(', ');
  const placeholders      = entries.map((_, i) => `$${i + 1}`).join(', ');
  const params            = entries.map(([, v]) => v);

  const updateSet = snakeCols
    .filter((col) => col !== conflictCol)
    .map((col) => {
      const q = quoteIdentifier(col);
      return `${q} = EXCLUDED.${q}`;
    })
    .join(', ');

  if (!updateSet) {
    return {
      sql: [
        `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
        `ON CONFLICT (${quotedConflictCol}) DO NOTHING`,
        'RETURNING *',
      ].join(' '),
      params,
    };
  }

  return {
    sql: [
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
      `ON CONFLICT (${quotedConflictCol}) DO UPDATE SET ${updateSet}`,
      'RETURNING *',
    ].join(' '),
    params,
  };
}
