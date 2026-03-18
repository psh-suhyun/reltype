/**
 * snake_case 문자열을 camelCase로 변환합니다.
 * 예: "first_name" → "firstName"
 */
export function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * camelCase 문자열을 snake_case로 변환합니다.
 * 예: "firstName" → "first_name"
 */
export function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * 객체의 모든 key를 camelCase로 변환합니다.
 */
export function keysToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toCamel(k), v])
  );
}

/**
 * 객체의 모든 key를 snake_case로 변환합니다.
 */
export function keysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toSnake(k), v])
  );
}
