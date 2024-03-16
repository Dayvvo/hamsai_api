import { Module } from 'nestgram';
import { NestgramService } from './nestgram.service';
import { NestgramController } from './nestgram.controller';
import { RedisModule } from '@liaoliaots/nestjs-redis';

@Module({
  imports: [],
  controllers: [NestgramController],
  services: [NestgramService],
})
export class NestgramModule {}
