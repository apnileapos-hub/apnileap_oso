import { Module } from '@nestjs/common';
import { BookstackService } from './bookstack.service';

@Module({
  providers: [BookstackService],
  exports: [BookstackService],
})
export class BookstackModule {}
