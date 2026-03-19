import { ColShape } from './interfaces/Column';

/**
 * 컬럼 정의 빌더 클래스.
 *
 * 타입 파라미터:
 * - T        : TypeScript 타입 (phantom)
 * - IsOpt    : INSERT 시 optional 여부
 * - IsPrimary: primary key 여부
 */
export class Col<
  T = unknown,
  IsOpt extends boolean = false,
  IsPrimary extends boolean = false,
> implements ColShape<T, IsOpt, IsPrimary> {
  declare readonly _type: T;
  declare readonly _isOpt: IsOpt;
  declare readonly _isPrimary: IsPrimary;

  constructor(
    readonly pgType: string,
    readonly isNullable: boolean = false,
    readonly hasDefault: boolean = false,
    readonly isPrimary: boolean = false,
    readonly length?: number,
    /** DEFAULT NOW() 여부 — SQL 힌트 용도 */
    readonly isDefaultNow: boolean = false,
  ) {}

  /** 컬럼을 nullable로 설정합니다. (INSERT도 optional) */
  nullable(): Col<T | null, true, IsPrimary> {
    return new Col<T | null, true, IsPrimary>(
      this.pgType, true, this.hasDefault, this.isPrimary, this.length, this.isDefaultNow,
    );
  }

  /** 컬럼을 NOT NULL로 설정합니다. */
  notNull(): Col<Exclude<T, null>, false, IsPrimary> {
    return new Col<Exclude<T, null>, false, IsPrimary>(
      this.pgType, false, this.hasDefault, this.isPrimary, this.length, this.isDefaultNow,
    );
  }

  /** primary key로 설정합니다. (INSERT optional) */
  primaryKey(): Col<T, true, true> {
    return new Col<T, true, true>(
      this.pgType, this.isNullable, true, true, this.length, this.isDefaultNow,
    );
  }

  /**
   * DB 기본값이 있는 컬럼으로 설정합니다. (INSERT optional)
   *
   * @example col.boolean().default()      // BOOLEAN DEFAULT false 등
   */
  default(): Col<T, true, IsPrimary> {
    return new Col<T, true, IsPrimary>(
      this.pgType, this.isNullable, true, this.isPrimary, this.length, false,
    );
  }

  /**
   * DEFAULT NOW() 컬럼으로 설정합니다. (INSERT optional)
   * `default()`와 타입은 동일하나 `isDefaultNow: true`로 구분됩니다.
   *
   * @example col.timestamptz().defaultNow()
   */
  defaultNow(): Col<T, true, IsPrimary> {
    return new Col<T, true, IsPrimary>(
      this.pgType, this.isNullable, true, this.isPrimary, this.length, true,
    );
  }

  /**
   * 런타임에서 INSERT optional 여부를 반환합니다.
   * isNullable, hasDefault, isPrimary 중 하나라도 true이면 optional입니다.
   */
  get isOptional(): boolean {
    return this.isNullable || this.hasDefault || this.isPrimary;
  }
}

/**
 * 컬럼 빌더 팩토리.
 *
 * @example
 * ```ts
 * const usersTable = defineTable('users', {
 *   id:        col.serial().primaryKey(),
 *   name:      col.varchar(255).notNull(),
 *   email:     col.text().notNull(),
 *   isActive:  col.boolean().default(),
 *   createdAt: col.timestamptz().defaultNow(),
 * });
 * ```
 */
export const col = {
  serial:      ()              => new Col<number,  true,  false>('serial',      false, true,  false),
  integer:     ()              => new Col<number,  false, false>('integer',     false, false, false),
  bigint:      ()              => new Col<bigint,  false, false>('bigint',      false, false, false),
  numeric:     ()              => new Col<number,  false, false>('numeric',     false, false, false),
  varchar:     (len?: number)  => new Col<string,  false, false>('varchar',     false, false, false, len),
  text:        ()              => new Col<string,  false, false>('text',        false, false, false),
  boolean:     ()              => new Col<boolean, false, false>('boolean',     false, false, false),
  timestamp:   ()              => new Col<Date,    false, false>('timestamp',   false, false, false),
  timestamptz: ()              => new Col<Date,    false, false>('timestamptz', false, false, false),
  date:        ()              => new Col<Date,    false, false>('date',        false, false, false),
  uuid:        ()              => new Col<string,  false, false>('uuid',        false, false, false),
  jsonb:       <T = unknown>() => new Col<T,       false, false>('jsonb',       false, false, false),
};
