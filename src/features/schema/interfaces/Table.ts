import { ColShape } from './Column';

export type Cols = Record<string, ColShape<unknown, boolean, boolean>>;

export interface TableDef<
  TName extends string = string,
  TCols extends Cols = Cols,
> {
  /** 테이블 이름 (schema 미포함 순수 테이블명) */
  readonly name: TName;
  /** PostgreSQL 스키마 이름 (예: 'public', 'user', 'audit'). 없으면 undefined. */
  readonly schema: string | undefined;
  /**
   * 쿼리에서 사용되는 완전한 식별자.
   *
   * - schema 있음: `"schema"."table"`
   * - schema 없음: `"table"`
   *
   * @example
   * // schema 없음
   * defineTable('users', cols).qualifiedName          // "users"
   * // schema 있음
   * defineTable('users', cols, { schema: 'auth' }).qualifiedName  // "auth"."users"
   * // 도트 표기
   * defineTable('auth.users', cols).qualifiedName     // "auth"."users"
   */
  readonly qualifiedName: string;
  readonly cols: TCols;
}
