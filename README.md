# rodex

A TypeScript library for seamless Redis caching with MySQL and MongoDB support, implementing the cache-aside pattern with dependency injection.

---

## Features

---

## Installation

```bash
npm install rodex
```

---

## Quick Start

```typescript
import { init, serviceClient } from 'rodex';

// 1. Initialize with your existing connections
await init({
    redisClient: myRedisClient, // redis v2 client
    sqlPool: mySqlPool, // mysql2/promise pool
    mongoDb: myMongoDb, // mongodb Db instance (optional)
});

// 2. Use serviceClient anywhere in your app
```

---

## Usage

### 1. Initialize the Service

```typescript
import { init } from 'rodex';

// 1. Initialize with your existing connections
await init({
    redisClient: myRedisClient, // redis v2 client
    sqlPool: mySqlPool, // mysql2/promise pool
    mongoDb: myMongoDb, // mongodb Db instance (optional)
});
```

### 2. Use the Service Client

```typescript
import { serviceClient } from 'rodex';

// 2. Use serviceClient anywhere in your app
```

---

## API — `serviceClient`

### Redis Operations

```typescript
await serviceClient.get('key');
await serviceClient.set('key', 'value', 3600); // with TTL
await serviceClient.hGet('key', 'field'); // single hash field
await serviceClient.hGet('key', ['f1', 'f2']); // multiple hash fields
await serviceClient.hGet('key'); // all hash fields
await serviceClient.hSet('key', { name: 'John', age: '25' }, 3600);
await serviceClient.hSetField('key', 'email', 'a@b.com', 3600);
await serviceClient.del('key');
await serviceClient.unlink('key');
await serviceClient.unlinkByPattern('user');
await serviceClient.hDel('key', ['field1', 'field2']);
await serviceClient.scan('user:*');
await serviceClient.quit();
```

### SQL (MySQL) Operations

```typescript
const users = await serviceClient.executeSqlQuery<User>('SELECT * FROM users WHERE id = ?', [1]);
```

### MongoDB Operations

```typescript
const docs = await serviceClient.mongoFind<Doc>('collection', { active: true }, { limit: 10 });
const doc = await serviceClient.mongoFindOne<Doc>('collection', { _id: id });
await serviceClient.mongoInsertOne('collection', { name: 'New' });
await serviceClient.mongoUpdateOne('collection', { _id: id }, { $set: { name: 'Updated' } });
await serviceClient.mongoDeleteOne('collection', { _id: id });
const agg = await serviceClient.mongoAggregate<Doc>('collection', [{ $match: {} }]);
```

### Cache-Aside (Redis + DB)

```typescript
// SQL cache-aside
const users = await serviceClient.getCached<User>({ key: 'active-users', expirationInSec: config.Expiry.LONG }, 'SELECT * FROM users WHERE active = 1');

const user = await serviceClient.getCachedOne<User>({ key: 'user:1', field: 'info', expirationInSec: config.Expiry.HALF_DAY }, 'SELECT * FROM users WHERE id = ?', [1]);

// MongoDB cache-aside
const docs = await serviceClient.getCachedMongo<Doc>({ key: 'active-docs', expirationInSec: config.Expiry.MEDIUM }, 'documents', { active: true });

const doc = await serviceClient.getCachedMongoOne<Doc>({ key: `doc:${id}`, expirationInSec: config.Expiry.SHORT }, 'documents', { _id: id });

// Invalidation
await serviceClient.invalidate('user:1'); // delete key
await serviceClient.invalidate('user:1', 'info'); // delete hash field
await serviceClient.invalidateByPattern('user'); // delete by pattern
```

---

## `config` — Constants

```typescript
import { config } from 'rodex';

config.Expiry.SHORT; // 5 min
config.Expiry.MEDIUM; // 30 min
config.Expiry.LONG; // 1 hour
config.Expiry.HALF_DAY; // 12 hours
config.Expiry.ONE_DAY; // 24 hours

config.DbType.MySQL; // 'mysql'
config.DbType.MongoDB; // 'mongodb'

config.ContainerToken; // TypeDI tokens
```

---

## `init()` — Options

| Option         | Type          | Default                 | Description                    |
| -------------- | ------------- | ----------------------- | ------------------------------ |
| `redisClient`  | `RedisClient` | `null`                  | Redis v2 client instance       |
| `redisEnabled` | `boolean`     | `true`                  | Enable/disable Redis           |
| `sqlPool`      | `Pool`        | `null`                  | mysql2/promise connection pool |
| `mongoDb`      | `MongoDb`     | `null`                  | MongoDB Db instance            |
| `logLevel`     | `string`      | `'warn'`                | bunyan log level               |
| `loggerName`   | `string`      | `'rodex'`               | Logger name                    |

---

## Cache-Aside Flow

```
App → Check Redis → Hit? Return
                   → Miss? → Query DB → Cache result → Return
```

---

## Example: UserService

```typescript
import { init, serviceClient, config } from 'rodex';

class UserService {
    async getUser(id: number) {
        return serviceClient.getCachedOne<User>({ key: `user:${id}`, field: 'info', expirationInSec: config.Expiry.LONG }, 'SELECT * FROM users WHERE id = ?', [id]);
    }

    async updateUser(id: number, name: string) {
        await serviceClient.executeSqlQuery('UPDATE users SET name = ? WHERE id = ?', [name, id]);
        await serviceClient.invalidate(`user:${id}`);
    }
}
```

---

## Development

```bash
npm install       # Install dependencies
npm run build     # Build TypeScript
npm test          # Build + run tests
npm run lint      # Lint
```

---

## License

MIT
