import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestGram } from 'nestgram';
import { NestgramModule } from './nestgram/nestgram.module';
import * as dotenv from 'dotenv';

dotenv.config();
async function bootstrap() {
  const bot = new NestGram(process.env.NESTGRAM_BOT_KEY!, NestgramModule);

  await bot.start();
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
