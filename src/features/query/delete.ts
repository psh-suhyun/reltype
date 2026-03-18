import { buildWhere } from './where';
import { BuiltQuery } from './interfaces/Query';
import { WhereInput } from './interfaces/Where';

/**
 * DELETE 쿼리를 생성합니다.
 * camelCase key → snake_case 컬럼명으로 자동 변환됩니다.
 */
export function buildDelete<T extends Record<string, unknown>>(
  table: string,
  where: WhereInput<T>,
): BuiltQuery {
  const { sql: whereSql, params } = buildWhere(where);

  return {
    sql: [`DELETE FROM ${table}`, whereSql].filter(Boolean).join(' '),
    params,
  };
}
