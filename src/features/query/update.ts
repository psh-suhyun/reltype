import { toSnake } from '../transform/case';
import { quoteIdentifier } from '../../utils/sqlGuard';
import { buildWhere } from './where';
import { BuiltQuery } from './interfaces/Query';
import { WhereInput } from './interfaces/Where';
import { Logger } from '../../utils/logger';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Query]' },
);

/**
 * UPDATE 쿼리를 생성합니다. RETURNING * 으로 수정된 row를 반환합니다.
 * camelCase key → snake_case 컬럼명으로 자동 변환됩니다.
 * 모든 컬럼명은 `quoteIdentifier`로 검증 및 이스케이프됩니다.
 *
 * 수정할 데이터가 없거나 WHERE 조건이 없으면 빈 쿼리를 반환합니다 (실행 시 no-op).
 */
export function buildUpdate<T extends Record<string, unknown>>(
  table: string,
  data: Partial<T>,
  where: WhereInput<T>,
): BuiltQuery {
  const entries      = Object.entries(data).filter(([, v]) => v !== undefined);
  const whereEntries = Object.entries(where).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    logger.error(`buildUpdate [${table}]: 수정할 데이터가 없습니다.`);
    return { sql: '', params: [] };
  }

  if (whereEntries.length === 0) {
    logger.error(`buildUpdate [${table}]: WHERE 조건이 없습니다. 전체 행 업데이트를 방지합니다.`);
    return { sql: '', params: [] };
  }

  const params: unknown[] = [];
  const setClauses = entries.map(([k, v]) => {
    params.push(v);
    return `${quoteIdentifier(toSnake(k))} = $${params.length}`;
  });

  const { sql: whereSql, params: whereParams } = buildWhere(where, params.length + 1);
  params.push(...whereParams);

  const sql = [
    `UPDATE ${table}`,
    `SET ${setClauses.join(', ')}`,
    whereSql,
    'RETURNING *',
  ]
    .filter(Boolean)
    .join(' ');

  return { sql, params };
}
