import { buildWhere } from './where';
import { BuiltQuery } from './interfaces/Query';
import { WhereInput } from './interfaces/Where';
import { Logger } from '../../utils/logger';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Query]' },
);

/**
 * DELETE 쿼리를 생성합니다. RETURNING * 으로 삭제된 row를 반환합니다.
 * camelCase key → snake_case 컬럼명으로 자동 변환됩니다.
 *
 * WHERE 조건이 없으면 빈 쿼리를 반환합니다 (전체 삭제 방지, 실행 시 no-op).
 */
export function buildDelete<T extends Record<string, unknown>>(
  table: string,
  where: WhereInput<T>,
): BuiltQuery {
  const whereEntries = Object.entries(where).filter(([, v]) => v !== undefined);

  if (whereEntries.length === 0) {
    logger.error(`buildDelete [${table}]: WHERE 조건이 없습니다. 전체 행 삭제를 방지합니다.`);
    return { sql: '', params: [] };
  }

  const { sql: whereSql, params } = buildWhere(where);

  return {
    sql: [`DELETE FROM ${table}`, whereSql, 'RETURNING *'].filter(Boolean).join(' '),
    params,
  };
}
