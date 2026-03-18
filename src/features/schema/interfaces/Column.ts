/**
 * Col 클래스의 타입 파라미터를 외부에서 읽기 위한 인터페이스.
 *
 * - _type     : 컬럼의 TypeScript 타입 (phantom)
 * - _isOpt    : INSERT 시 optional 여부 (primaryKey · hasDefault · nullable)
 * - _isPrimary: primary key 여부
 */
export interface ColShape<
  T = unknown,
  IsOpt extends boolean = boolean,
  IsPrimary extends boolean = boolean,
> {
  readonly _type: T;
  readonly _isOpt: IsOpt;
  readonly _isPrimary: IsPrimary;
  readonly pgType: string;
  readonly isNullable: boolean;
  readonly hasDefault: boolean;
  readonly isPrimary: boolean;
  readonly isOptional: boolean;
  readonly length?: number;
}
