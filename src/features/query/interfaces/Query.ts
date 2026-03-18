/** SQL 문자열과 parameterized 값 묶음 */
export interface BuiltQuery {
  readonly sql: string;
  readonly params: unknown[];
}
