/**
 * snake_case 문자열을 camelCase로 변환합니다.
 *
 * @example
 * toCamel('first_name')  // 'firstName'
 * toCamel('user_id')     // 'userId'
 * toCamel('url_param')   // 'urlParam'
 */
export function toCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * camelCase 문자열을 snake_case로 변환합니다.
 * 두문자어(Acronym)도 올바르게 처리합니다.
 *
 * @example
 * toSnake('firstName')  // 'first_name'
 * toSnake('userId')     // 'user_id'
 * toSnake('URLParam')   // 'url_param'
 * toSnake('userID')     // 'user_id'
 */
export function toSnake(str: string): string {
  return str
    // 연속 대문자 뒤에 소문자가 오는 경우: "URLParam" → "URL_Param"
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // 소문자/숫자 뒤에 대문자: "camelCase" → "camel_Case"
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * 객체의 모든 key를 camelCase로 변환합니다.
 */
export function keysToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toCamel(k), v]),
  );
}

/**
 * 객체의 모든 key를 snake_case로 변환합니다.
 */
export function keysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toSnake(k), v]),
  );
}
