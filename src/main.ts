import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestGram } from 'nestgram';
import { NestgramModule } from './nestgram/nestgram.module';
import * as dotenv from 'dotenv';

dotenv.config();
async function bootstrap() {
  const bot = new NestGram(process.env.NESTGRAM_BOT_KEY!, NestgramModule);

  try {
    await bot.start();
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
  } catch (error) {
    console.log(error);
  }
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Implement your logging mechanism here
    // Consider gracefully shutting down the server and restarting it
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Implement your logging mechanism here
    // Consider gracefully shutting down the server and restarting it
  });
}
bootstrap();
