import { TableDef, Cols } from './interfaces/Table';

/**
 * 테이블 정의를 생성합니다.
 *
 * @example
 * ```ts
 * const usersTable = defineTable('users', {
 *   id:    col.serial().primaryKey(),
 *   name:  col.varchar(255).notNull(),
 * });
 * ```
 */
export function defineTable<TName extends string, TCols extends Cols>(
  name: TName,
  cols: TCols,
): TableDef<TName, TCols> {
  return { name, cols };
}
