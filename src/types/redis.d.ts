import { EventEmitter } from 'events';

declare module 'redis' {
    export interface RedisClient extends EventEmitter {
        // Promisified methods (added by bluebird)
        getAsync(key: string): Promise<string | null>;
        setAsync(key: string, value: string | number | boolean | null, ...args: (string | number)[]): Promise<string>;
        delAsync(key: string): Promise<number>;
        hgetAsync(key: string, field: string): Promise<string | null>;
        hdelAsync(key: string, ...fields: string[]): Promise<number>;
        hgetallAsync(key: string): Promise<{ [key: string]: string } | null>;
        hmgetAsync(key: string, fields: string[]): Promise<(string | null)[]>;
        hmsetAsync(key: string, data: { [key: string]: string | number | boolean | null }): Promise<string>;
        hsetAsync(key: string, field: string, value: string | number | boolean | null): Promise<number>;
        expireAsync(key: string, seconds: number): Promise<number>;
        scanAsync(cursor: string, ...args: (string | number)[]): Promise<[string, string[]]>;
        unlinkAsync(...keys: string[]): Promise<number>;
        quitAsync(): Promise<void>;
    }

    export interface Multi {
        unlink(key: string): Multi;
        execAsync(): Promise<unknown[]>;
    }
}
