/**
 * TypeDI container tokens for injecting connections.
 */
export enum ContainerToken {
    REDIS = 'cache.wrapper.redis',
    SQL_POOL = 'cache.wrapper.sql.pool',
    MONGO_CLIENT = 'cache.wrapper.mongo.client',
    MONGO_DB = 'cache.wrapper.mongo.db',
    CONFIG = 'cache.wrapper.config',
}

/**
 * Supported database types.
 */
export enum DbType {
    MySQL = 'mysql',
    MongoDB = 'mongodb',
}

/**
 * Default cache expiry times (in seconds).
 */
export enum Expiry {
    SHORT = 60 * 5, // 5 minutes
    MEDIUM = 60 * 30, // 30 minutes
    LONG = 60 * 60, // 1 hour
    HALF_DAY = 60 * 60 * 12, // 12 hours
    ONE_DAY = 60 * 60 * 24, // 24 hours
}

const config = {
    ContainerToken,
    DbType,
    Expiry,
    LoggerName: 'rodex',
};

export default config;
