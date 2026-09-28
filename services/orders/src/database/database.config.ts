import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * `DATABASE_URL` is either a PostgreSQL URL or `sqlite:<path>` (`sqlite::memory:` for tests).
 * Tables are created with `synchronize`, which keeps the demo self-contained.
 */
export function databaseConfig(config: ConfigService): TypeOrmModuleOptions {
  const url = config.get<string>('DATABASE_URL', 'sqlite:orders.db');
  if (url.startsWith('sqlite:')) {
    return {
      type: 'better-sqlite3',
      database: url.slice('sqlite:'.length),
      autoLoadEntities: true,
      synchronize: true,
    };
  }
  return {
    type: 'postgres',
    url,
    autoLoadEntities: true,
    synchronize: true,
  };
}
