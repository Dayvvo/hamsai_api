import { GetState, Service } from 'nestgram';
import { Keyboard, KeyboardTypes, MessageSend } from 'nestgram';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import * as bs58 from 'bs58';
import { IMyState, poolsNames } from './nestgram.controller';
import { config } from 'dotenv';
import * as dayjs from 'dayjs';
import { Logger, OnModuleInit } from '@nestjs/common';
import mongoose from 'mongoose';
import { Bet, BetModel, BetStatus, PoolBets } from 'src/models/bet.model';
import { UserBet, UserModel } from 'src/models/user.model';
import { getBalance } from './hamsai.helper';
config();

@Service()
export class NestgramService implements OnModuleInit {
  connection: Connection;
  constructor() {
    this.startNewGame = this.startNewGame.bind(this);
    this.connection = new Connection(process.env.RPC_CONNECTION!);
  }
  async onModuleInit() {
    await mongoose.connect(process.env.MONGO_URL);

    this.logger.verbose(`Connected to db!`);
  }

  @GetState() state: IMyState;

  logger = new Logger(NestgramService.name);

  redisGameKey = 'HAMSAI_GAME';

  async startNewGame(
    tgHandle: string,
    duration: number,
  ): Promise<{ message: string }> {
    try {
      const endsAt = dayjs().add(duration, 'seconds').toDate();
      const existingStartedOrCreatedGame = await BetModel.find({
        status: { $ne: BetStatus.Finished },
      });

      if (existingStartedOrCreatedGame.length) {
        throw new Error('There is already started bet you need to resolve!');
      }

      const newRace = await BetModel.create({
        createdAt: new Date(),
        createdBy: tgHandle,
        endsAt,
        status: BetStatus.Created,
      });

      this.logger.log(`Created new race ${newRace.id.toString()}`);
      return { message: 'Successfully created new race!' };
    } catch (error) {
      this.logger.error(error.message);
      console.log(error);
      return { message: error.message };
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
      return new MessageSend(
        'You already created wallet. Public Key: ' + `\`${user.walletPubkey}\``,
        undefined,
        { parse_mode: 'Markdown' },
      );
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
      bets: [],
      earnedFunds: 0,
      spentFunds: 0,
    });

    return new MessageSend(
      `🎉 Your new wallet has been created! 🎉\n\n` +
        `Public Key: \n\`${publicKey}\`\n\n` +
        `Please send some SOL to this address to start  playing.\n\n`,
      undefined,
      { parse_mode: 'Markdown' },
    );
  }
  async handlePlaceBet(username: string, betPool: number, betAmount: number) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const user = await UserModel.findOne({ username });
      if (!user) throw new Error('User not found!');

      const balance = await getBalance(user.walletPubkey);

      const liveRace = await BetModel.findOne({ status: BetStatus.Created });

      if (!liveRace) {
        throw new Error('No active bet or race already started!');
      }

      const holdings = balance + user.earnedFunds - user.spentFunds;
      if (betAmount > holdings)
        throw new Error(`Not enough funds!Your bet balance is ${holdings} `);

      if (betPool < 0 || betPool > poolsNames.length) {
        throw new Error('Invalid pool bet');
      }

      const placedBet = user.bets.some((s) => s.bet.equals(liveRace._id));

      if (placedBet) throw new Error(`You already placed bet!`);

      const newBet: UserBet = {
        bet: liveRace._id,
        betAmount,
        poolId: betPool,
      };

      await UserModel.updateOne(
        { _id: user._id },
        { $push: { bets: newBet }, $inc: { spentFunds: betAmount } },
      );

      const pool = liveRace.bets.findIndex((b) => b.poolId === betPool);

      if (pool >= 0) {
        await BetModel.updateOne(
          { _id: liveRace._id },
          {
            $inc: {
              [`bets.${pool}.totalSol`]: betAmount,
              [`bets.${pool}.totalBets`]: 1,
            },
          },
        );
      } else {
        const bet: PoolBets = {
          poolId: betPool,
          totalBets: 1,
          totalSol: betAmount,
        };
        await BetModel.updateOne(
          { _id: liveRace._id },
          { $push: { bets: bet } },
        );
      }

      await session.commitTransaction();
      return { message: 'Successfully placed bet' };
    } catch (error) {
      session.abortTransaction();
      return {
        message: error.message,
      };
    } finally {
      session.endSession();
    }
  }

  async withdrawFunds(username: string, amount: number, wallet: string) {
    try {
    } catch (error) {
      return { message: error.message };
    }
  }

  async startBet() {
    try {
      const bet = await BetModel.findOne({ status: BetStatus.Created });

      if (!bet) throw new Error('No created bets!');

      await BetModel.updateOne(
        { _id: bet._id },
        { $set: { status: BetStatus.Started } },
      );

      return 'Successfully started bet!';
    } catch (error) {
      return error.message;
    }
  }

  async resolveBet(winner: number) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const activeGame = await BetModel.findOne({ status: BetStatus.Started });

      if (!activeGame) throw new Error('There is no active bet!');

      if (winner < 0 || winner > poolsNames.length)
        throw new Error('Invalid pool!');

      const users = await UserModel.find({
        bets: { $elemMatch: { bet: activeGame._id, poolId: winner } },
      });

      const totalSol = activeGame.bets.reduce(
        (acc, val) => acc + val.totalSol,
        0,
      );

      await Promise.all(
        users.map(async (u) => {
          try {
            const bet = u.bets.find(
              (b) => b.bet.equals(activeGame._id) && b.poolId === winner,
            );

            if (bet) {
              const pct =
                totalSol - bet.betAmount === 0
                  ? 0
                  : bet.betAmount / (totalSol - bet.betAmount);

              const toTransfer = bet.betAmount + pct * totalSol;

              await UserModel.updateOne(
                { _id: u._id },
                { $inc: { earnedFunds: toTransfer } },
              );
            }
          } catch (error) {}
        }),
      );

      await BetModel.updateOne(
        { _id: activeGame._id },
        {
          $set: {
            winningPool: winner,
            status: BetStatus.Finished,
          },
        },
      );

      await session.commitTransaction();

      return `Successfully resolved bet!`;
    } catch (error) {
      this.logger.error(error.message);

      return error.message;
    } finally {
      session.endSession();
    }
  }
}
