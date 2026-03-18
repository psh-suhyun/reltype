import { toSnake } from '../transform/case';
import { buildWhere } from './where';
import { BuiltQuery } from './interfaces/Query';
import { WhereInput } from './interfaces/Where';

/**
 * UPDATE 쿼리를 생성합니다. RETURNING * 으로 수정된 row를 반환합니다.
 * camelCase key → snake_case 컬럼명으로 자동 변환됩니다.
 */
export function buildUpdate<T extends Record<string, unknown>>(
  table: string,
  data: Partial<T>,
  where: WhereInput<T>,
): BuiltQuery {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);

  const params: unknown[] = [];
  const setClauses = entries.map(([k, v]) => {
    params.push(v);
    return `${toSnake(k)} = $${params.length}`;
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
