import { Global, Module } from '@nestjs/common';
import { TransactionRunner } from './transaction-runner.js';

@Global()
@Module({
  providers: [TransactionRunner],
  exports: [TransactionRunner],
})
export class DatabaseModule {}
