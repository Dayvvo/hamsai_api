import { GetState, IMessage, Photo, Service } from 'nestgram';
import { Keyboard, KeyboardTypes, MessageSend } from 'nestgram';
import {
  AccountMeta,
  AddressLookupTableProgram,
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
  authority,
  connection,
  getGameData,
  getPlaceBet,
  getResolveBetIxs,
  getStartMission,
  getTreasurySeed,
  hamsaiProgram,
  sendAndConfirmTx,
} from './hamsai.helper';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Race, RaceModel, RaceState, UserModel } from 'src/models/user.model';
import * as nacl from 'tweetnacl';
import { passphrase } from './env';
import mongoose from 'mongoose';
import { decode, encode } from 'bs58';
import { AnchorError } from '@project-serum/anchor';
import { chunk } from 'lodash';
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
      let race = await RaceModel.find();

      if (race[0] && race[0].state !== RaceState.Finished) {
        return { message: 'Previous race was not finished!' };
      }

      if (!race || race.length === 0) {
        const newRace = await RaceModel.create({
          state: RaceState.Betting,
          updatedAt: new Date(),
        });
        race = [newRace];
      }

      const [r] = race;
      r.state = RaceState.Betting;
      r.updatedAt = new Date();
      await r.save();

      const ix = await getStartMission(duration);

      const sig = await sendAndConfirmTx([ix]);
      console.log(`Started mission with sig: ${ix}`);
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
        '🎰 Join our community, place your bets, and watch as the winning hamster brings you a fortune. Each race features 5 pools - the winner takes the entire pot, minus a small tax, evenly split based on the bet amount. Don’t miss out, start betting now and may the best hamster win! 🐹💰',
      new Keyboard(KeyboardTypes.underTheMessage)
        .btn('🎮 Play Now!', 'play')
        .row()
        .btn('👥 Show pools', 'availablePools')
        .row()
        .btn('❓ Help', 'help')
        .btn('⚙️ Settings', 'settings'),
    );
  }

  async createWalletMessage(username: string) {
    const user = await UserModel.findOne({ username: username });

    if (user) {
      return 'You already created wallet. Public Key: ' + user.walletPubkey;
    }

    const newWallet = Keypair.generate();
    const publicKey = newWallet.publicKey.toBase58();
    const secretKey = bs58.encode(newWallet.secretKey);

    await UserModel.create({
      totalBets: 0,
      totalEarnings: 0,
      username: username,
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

      console.log(dayjs.unix(gameData.startedAt.toNumber()).toDate());
      // if (
      //   dayjs
      //     .unix(gameData.startedAt.toNumber() + gameData.duration.toNumber())
      //     .isBefore(dayjs())
      // ) {
      //   return { success: false, message: 'Race has ended!' };
      // }

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
      if (error instanceof AnchorError) {
        const err: AnchorError = error;
        return { success: false, message: err.message };
      } else {
        if (error.message.includes('0x1774')) {
          return { success: false, message: 'Race expired' };
        }
        return { success: false, message: error.message };
      }
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

  async resolveBet(winner: number) {
    try {
      const gameData = await getGameData();

      const [race] = await RaceModel.find();

      if (race.state !== RaceState.Racing) {
        return 'Race is not in proper state!';
      }

      const instructions = await getResolveBetIxs(winner);

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

      race.state = RaceState.Finished;
      await race.save();

      return `Resolved race! \n https://solscan.io/tx/${sig}`;
    } catch (error) {
      this.logger.error(error.message);
      return error.message;
    }
  }
}
