import { toSnake } from '../transform/case';
import { BuiltQuery } from './interfaces/Query';

/**
 * INSERT 쿼리를 생성합니다. RETURNING * 으로 삽입된 row를 반환합니다.
 * camelCase key → snake_case 컬럼명으로 자동 변환됩니다.
 */
export function buildInsert(
  table: string,
  data: Record<string, unknown>,
): BuiltQuery {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);

  const cols        = entries.map(([k]) => toSnake(k)).join(', ');
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
  const params      = entries.map(([, v]) => v);

  return {
    sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
    params,
  };
}
