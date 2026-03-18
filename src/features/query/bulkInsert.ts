import { toSnake } from '../transform/case';
import { BuiltQuery } from './interfaces/Query';

/**
 * 여러 row를 한 번의 INSERT 쿼리로 삽입합니다.
 * 빈 배열이 전달되면 빈 BuiltQuery를 반환합니다.
 *
 * @param table - 테이블명 (snake_case)
 * @param rows  - 삽입할 데이터 배열 (camelCase key, 모든 row는 동일한 key 구조여야 합니다)
 */
export function buildBulkInsert(
  table: string,
  rows: Record<string, unknown>[],
): BuiltQuery {
  if (rows.length === 0) {
    return { sql: '', params: [] };
  }

  const keys   = Object.keys(rows[0]).filter((k) => rows[0][k] !== undefined);
  const cols   = keys.map(toSnake).join(', ');
  const params: unknown[] = [];

  const valueSets = rows.map((row) => {
    const placeholders = keys.map((k) => {
      params.push(row[k]);
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  return {
    sql: `INSERT INTO ${table} (${cols}) VALUES ${valueSets.join(', ')} RETURNING *`,
    params,
  };
}
