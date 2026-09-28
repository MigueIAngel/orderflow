import { DataSource } from 'typeorm';
import { TransactionRunner } from './transaction-runner.js';

describe('TransactionRunner on SQLite', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
    });
    await dataSource.initialize();
    await dataSource.query('CREATE TABLE counter (n INTEGER)');
    await dataSource.query('INSERT INTO counter VALUES (0)');
  });

  afterEach(() => dataSource.destroy());

  it('queues concurrent transactions instead of interleaving them', async () => {
    const runner = new TransactionRunner(dataSource);
    const increment = () =>
      runner.run(async (manager) => {
        const [{ n }] = await manager.query('SELECT n FROM counter');
        await new Promise((resolve) => setTimeout(resolve, 5));
        await manager.query('UPDATE counter SET n = ?', [n + 1]);
      });

    await Promise.all(Array.from({ length: 10 }, increment));

    const [{ n }] = await dataSource.query('SELECT n FROM counter');
    expect(n).toBe(10);
  });

  it('keeps working after a failed transaction', async () => {
    const runner = new TransactionRunner(dataSource);
    await expect(
      runner.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(runner.run(async () => 'ok')).resolves.toBe('ok');
  });
});
