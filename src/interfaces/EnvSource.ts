export interface EnvSource {
    get(key: string): string | undefined;
}