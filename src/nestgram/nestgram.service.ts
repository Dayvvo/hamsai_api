import { GetState, IMessage, Photo, Service } from 'nestgram';
import { Keyboard, KeyboardTypes, MessageSend } from 'nestgram';
import {
  AccountMeta,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as path from 'path';
import { IMyState } from './nestgram.controller';
import { Hamsai } from 'src/providers/hamsai.provider';
import { decodeUTF8 } from 'tweetnacl-util';
import { config } from 'dotenv';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Tweetnacl from 'tweetnacl';
import Redis from 'ioredis';
import {
  GameStatus,
  IGame,
} from 'src/pool_configurator/pool_configurator.service';
import * as dayjs from 'dayjs';
import {
  connection,
  getGameData,
  getPlaceBet,
  getStartMission,
  getTreasurySeed,
  sendAndConfirmTx,
} from './hamsai.helper';
import { Logger, OnModuleInit } from '@nestjs/common';
import { UserModel } from 'src/models/user.model';
import * as nacl from 'tweetnacl';
import { passphrase } from './env';
import mongoose from 'mongoose';
import { decode, encode } from 'bs58';
config();

@Service()
export class NestgramService implements OnModuleInit {
  redis: Redis;
  constructor() {
    this.startNewGame = this.startNewGame.bind(this);
  }
  async onModuleInit() {
    await mongoose.connect(process.env.MONGO_URL);

    this.logger.verbose(`Connected to db!`);
  }

  @GetState() state: IMyState;

  logger = new Logger(NestgramService.name);

  redisGameKey = 'HAMSAI_GAME';

  async startNewGame(
    duration: number,
  ): Promise<{ message: string; signature?: string }> {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST!,
        port: parseInt(process.env.REDIS_PORT!),
        password: process.env.REDIS_PASSWORD!,
        username: process.env.REDIS_USERNAME!,
      });

      let game: IGame = JSON.parse(await this.redis.get(this.redisGameKey));

      if (game?.gameStatus === GameStatus.Active) {
        return {
          message: `Game is already active and it ends in ${
            game.endsAt - dayjs().unix()
          }seconds`,
        };
      }

      if (!game) {
        game = {
          createdAt: dayjs().unix(),
          endsAt: dayjs().unix() + duration,
          gameStatus: GameStatus.Active,
          totalBets: 0,
        };
      }
      game.createdAt = dayjs().unix();
      game.endsAt = dayjs().add(duration, 'seconds').unix();
      const ix = await getStartMission(duration);

      const sig = await sendAndConfirmTx([ix]);
      console.log(`Started mission with sig: ${ix}`);
      await this.redis.set(this.redisGameKey, JSON.stringify(game));
      return { message: 'Mission successfully started', signature: sig };
    } catch (error) {
      this.logger.error(error.message);
      console.log(error);
      return { message: 'Failed to start new mission!' };
    }
  }

  get helloWorldMessage(): any {
    return new MessageSend(
      'Welcome to HamsterAI Bot - your go-to destination for exhilarating hamster racing bets on Telegram! 🐹 Ready to place your bets? Click "Play Now!" to join the action. Experience the thrill of betting on your favorite hamsters in real-time. 🚀\n\n' +
        'Dive into the fun with two betting pools - bet on your champion hamster and join the excitement. All bets are pooled together, creating a big pot for the winners. 🏆\n\n' +
        'Got questions or need assistance? Our dedicated support team is here to help you 24/7.\n\n' +
        '🎰 Join our community, place your bets, and watch as the winning hamster brings you a fortune. Each race features 3 players and 3 pools - the winner takes the entire pot, minus a small tax, evenly split based on the bet amount. Don’t miss out, start betting now and may the best hamster win! 🐹💰',
      new Keyboard(KeyboardTypes.underTheMessage)
        .btn('🎮 Play Now!', 'play')
        .row()
        .btn('👥 Show pools', 'availablePools')
        .row()
        .btn('❓ Help', 'help')
        .btn('⚙️ Settings', 'settings'),
    );
  }

  async createWalletMessage(message: IMessage) {
    const user = await UserModel.findOne({ username: message.from.username });

    if (user) {
      return 'You already created wallet. Public Key: ' + user.walletPubkey;
    }

    const newWallet = Keypair.generate();
    const publicKey = newWallet.publicKey.toBase58();
    const secretKey = bs58.encode(newWallet.secretKey);

    await UserModel.create({
      totalBets: 0,
      totalEarnings: 0,
      username: message.from.username,
      walletKeypair: secretKey,
      walletPubkey: newWallet.publicKey.toString(),
    });

    return new MessageSend(
      `🎉 Your new wallet has been created! 🎉\n\n` +
        `Public Key: \n\`${publicKey}\`\n\n` +
        `Please send some SOL to this address to start  playing.\n\n` +
        `🔐 For your security, we will not store your secret key. 🔐\n\n` +
        `Please make sure to save it securely: \n\n` +
        `\`\`\`${secretKey}\`\`\``,
    );
  }
  async handlePlaceBet(username: string, betPool: number, betAmonut: number) {
    try {
      const user = await UserModel.findOne({ username });

      if (!user) {
        return { message: 'User does not exist!', success: false };
      }

      const kp = Keypair.fromSecretKey(decode(user.walletKeypair));
      const gameData = await getGameData();

      console.log(gameData);
      if (
        gameData.players.some((p) => p.user.toString() === user.walletPubkey)
      ) {
        return {
          message: 'You already placed bet in this round!',
          success: false,
        };
      }

      if (gameData.players.length === 250) {
        return { success: false, message: 'Entries cap reached!' };
      }

      if (
        dayjs
          .unix(gameData.startedAt.toNumber() + gameData.duration.toNumber())
          .isBefore(dayjs())
      ) {
        return { success: false, message: 'Race has ended!' };
      }

      const placeBetIx = await getPlaceBet(
        kp.publicKey,
        betPool,
        betAmonut * LAMPORTS_PER_SOL,
      );

      const sig = await sendAndConfirmTx([placeBetIx], [kp]);
      const poolsRecord = {};

      await Promise.all(
        gameData.activePools.map(async (p) => {
          const treasury = getTreasurySeed(p.id);
          const balance =
            (await connection.getBalance(treasury)) / LAMPORTS_PER_SOL;
          poolsRecord[p.id.toString()] = balance.toString();
        }),
      );

      return {
        message: 'Placed bet!',
        signature: sig,
        success: true,
        poolsRecord,
      };
    } catch (error) {
      if (error.message.includes('0x1')) {
        return {
          message: 'Not enough balance. You can deposit with /deposit command!',
          success: false,
        };
      }
      return { message: error.message, success: false };
      this.logger.error(error.message);
    }
  }

  async withdrawFunds(username: string, amount: number, wallet: string) {
    try {
      const user = await UserModel.findOne({ username });
      if (!user) {
        return { message: 'You dont own any wallet!', success: false };
      }

      try {
        new PublicKey(wallet);
      } catch (error) {
        return {
          message:
            'Invalid wallet! Send command in form /withdraw {wallet} {amount}',
          success: false,
        };
      }

      const kp = Keypair.fromSecretKey(bs58.decode(user.walletKeypair));

      const balance =
        (await connection.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
      if (balance < amount) {
        return {
          success: false,
          message:
            'Not enough balance to be withdrawn! Your balance is ' +
            balance +
            ' SOL',
        };
      }
      const systemTransfer = SystemProgram.transfer({
        fromPubkey: kp.publicKey,
        lamports: amount * LAMPORTS_PER_SOL,
        programId: SystemProgram.programId,
        toPubkey: new PublicKey(wallet),
      });
      const sig = await sendAndConfirmTx([systemTransfer], [kp]);
      return { message: 'Successfully withdrawn funds!', success: true, sig };
    } catch (error) {
      return { message: error.message };
    }
  }
}
