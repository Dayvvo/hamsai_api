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

  @Cron(CronExpression.EVERY_10_SECONDS)
  async tryResolveBet() {
    try {
      const game: IGame = JSON.parse(
        await this.redisService.get(this.redisGameKey),
      );

      const alts: string[] = JSON.parse(
        await this.redisService.get(this.altsKey),
      );
      if (!game) {
        this.logger.warn('No game found!');
        return;
      }

      const isEnded = dayjs.unix(game.endsAt).isBefore(dayjs());

      if (!isEnded) {
        this.logger.warn('Found non ended game!');
        return;
      }

      const gameData = await getGameData();

      if (gameData.players.length === 0) {
        this.logger.warn('Found on-chain game with 0 entries!');

        if (isEnded) {
          game.gameStatus = GameStatus.Paused;
          this.logger.log('Storing ended game');
          await this.redisService.set(this.redisGameKey, JSON.stringify(game));
        }
        return;
      }

      const instructions = await getResolveBetIxs();

      if (gameData.players.length > 25) {
        this.logger.verbose(
          `Found ${gameData.players.length} players,starting init of ALTs`,
        );
        const [createAltIx, alt] = AddressLookupTableProgram.createLookupTable({
          authority: authority.publicKey,
          payer: authority.publicKey,
          recentSlot: await connection.getSlot(),
        });
        await sendAndConfirmTx([createAltIx]);

        alts.push(alt.toString());

        await this.redisService.set(this.altsKey, JSON.stringify(alts));

        const keys = instructions
          .map((ix) => ix.keys.map((k) => k.pubkey))
          .flat();

        const chunked = chunk(keys, 15);

        for (const c of chunked) {
          const extend = AddressLookupTableProgram.extendLookupTable({
            addresses: c,
            authority: authority.publicKey,
            lookupTable: alt,
          });

          this.logger.log(`Extended lookup table with ${c.length} accounts!`);

          await sendAndConfirmTx([extend]);
        }
      }

      const sig = await sendAndConfirmTx(instructions);

      this.logger.log(`Resolved bet with sig: ${sig}`);

      game.gameStatus = GameStatus.Paused;
      game.totalBets = 0;
      await this.redisService.set(this.redisGameKey, JSON.stringify(game));
    } catch (error) {
      this.logger.error(error.message);
    }
  }

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
