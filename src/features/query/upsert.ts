import { toSnake } from '../transform/case';
import { BuiltQuery } from './interfaces/Query';

/**
 * INSERT ... ON CONFLICT DO UPDATE 쿼리를 생성합니다.
 * 충돌 컬럼을 제외한 나머지 컬럼을 EXCLUDED 값으로 업데이트합니다.
 *
 * @param table       - 테이블명 (snake_case)
 * @param data        - 삽입할 데이터 (camelCase key)
 * @param conflictCol - 충돌 기준 컬럼명 (snake_case)
 */
export function buildUpsert(
  table: string,
  data: Record<string, unknown>,
  conflictCol: string,
): BuiltQuery {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);

  const cols         = entries.map(([k]) => toSnake(k)).join(', ');
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
  const params       = entries.map(([, v]) => v);

  const updateSet = entries
    .map(([k]) => toSnake(k))
    .filter((col) => col !== conflictCol)
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(', ');

  return {
    sql: [
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
      `ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateSet}`,
      'RETURNING *',
    ].join(' '),
    params,
  };
}
