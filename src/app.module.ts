import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './models/user.model';
import { PoolConfiguratorModule } from './pool_configurator/pool_configurator.module';
import { NestgramService } from './nestgram/nestgram.service';
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      imports: [ConfigModule.forRoot()],
      useFactory: (configService: ConfigService) => {
        return {
          uri: configService.get('MONGO_URL'),
        };
      },
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ConfigModule.forRoot(),
    RedisModule.forRootAsync({
      imports: [ConfigModule.forRoot()],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          config: {
            url: configService.get('REDIS_URL'),
          },
        };
      },
    }),
    PoolConfiguratorModule,
  ],
  controllers: [AppController],
  providers: [AppService, NestgramService],
})
export class AppModule {}
