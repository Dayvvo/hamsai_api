import { InjectRedis, RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AddressLookupTableProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import * as dayjs from 'dayjs';
import Redis from 'ioredis';
import {
  authority,
  connection,
  getGameData,
  getResolveBetIxs,
  getStartMission,
  sendAndConfirmTx,
} from 'src/nestgram/hamsai.helper';
import { chunk } from 'lodash';
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
  constructor(@InjectRedis() private redisService: Redis) {}

  redisGameKey = 'HAMSAI_GAME';
  altsKey = 'ADDRESS_LOOKUP_TABLES';

  private logger = new Logger(PoolConfiguratorService.name);

  @Cron(CronExpression.EVERY_MINUTE)
  async closeAlts() {
    try {
      this.logger.debug(`Starting operation: Close address lookup tables!`);
      const alts: string[] = JSON.parse(
        await this.redisService.get(this.altsKey),
      );

      if (!alts) {
        this.logger.warn('No alts found!');
        return;
      }

      for (const alt of alts) {
        try {
          const parsedAlt = new PublicKey(alt);
          const closeAlt = AddressLookupTableProgram.closeLookupTable({
            authority: authority.publicKey,
            lookupTable: parsedAlt,
            recipient: authority.publicKey,
          });

          await sendAndConfirmTx([closeAlt]);
        } catch (error) {
          this.logger.error(`Failed to close alt with address ${alt}`);
        }
      }
    } catch (error) {}
  }
}
