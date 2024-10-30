import { InjectRedis, RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserModel } from 'src/models/user.model';

export enum GameStatus {
  Active,
  Paused,
}

export interface IGame {
  createdAt: number;
  endsAt: number;
  totalBets: Number;
  gameStatus: GameStatus;
}

@Injectable()
export class PoolConfiguratorService {
  constructor() {}

  redisGameKey = 'HAMSAI_GAME';
  altsKey = 'ADDRESS_LOOKUP_TABLES';

  @Cron(CronExpression.EVERY_10_MINUTES)
  async collectFees() {
    const users = await UserModel.find();

    await Promise.all(
      users.map(async (u) => {
        try {
        } catch (error) {}
      }),
    );
  }
}
