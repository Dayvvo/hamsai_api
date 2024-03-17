import {
  Answer,
  CommandParams,
  Controller,
  GetAnswer,
  GetState,
  IMessage,
  Keyboard,
  KeyboardTypes,
  Message,
  MessageSend,
  OnClick,
  OnCommand,
  OnMessage,
  OnText,
  Photo,
  SendOptions,
} from 'nestgram';
import { NestgramService } from './nestgram.service';
import fetch from 'node-fetch';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { Keypair } from '@solana/web3.js';
import {
  API_KEY,
  BASE_URI,
  BASE_URI_AUTH,
  ownersIds,
  SECRET_BOT_SIGNER,
} from './env';
import { UserModel } from 'src/models/user.model';
import { connection, getGameData, getTreasurySeed } from './hamsai.helper';
const base58 = require('base-58');

/**
 * Getting started by guide
 * https://degreetpro.gitbook.io/nestgram/getting-started/guide
 * */

export interface IMyState {
  chatId: any;
  selectedPool;
}

@Controller()
export class NestgramController {
  @GetState() state: IMyState;
  constructor(private readonly appService: NestgramService) {}

  @OnCommand('create_wallet')
  async createNewWallet(@Message() message: IMessage) {
    return await this.appService.createWalletMessage(message);
  }

  @OnCommand('start')
  async start() {
    const message = this.appService.helloWorldMessage;

    return new MessageSend(
      message,
      new Keyboard().btn('Commands ❓', 'commands'),
    );
  }

  @OnCommand('new_race')
  async startMission(message: any, @CommandParams() params: string[]) {
    if (!ownersIds.some((o) => o === message.message.from?.username)) {
      return 'You are not permitted to execute this command!';
    }
    const duration = Number(params[0]);
    if (isNaN(duration)) {
      return 'Invalid duration format!';
    }
    const { message: responseMessage, signature } =
      await this.appService.startNewGame(duration);

    return new MessageSend(responseMessage).next(
      `https://solscan.io/tx/${signature}`,
    );
  }

  @OnCommand('balance')
  async getBalance(@Message() message: IMessage) {
    try {
      const user = await UserModel.findOne({ username: message.from.username });
      if (!user) {
        return new MessageSend('You still have not created wallet!');
      }

      const balance =
        (await connection.getBalance(new PublicKey(user.walletPubkey))) /
        LAMPORTS_PER_SOL;

      return new MessageSend(`Balance: ${balance} 💸`);
    } catch (error) {
      return new MessageSend('Failed to fetch balance!');
    }
  }

  @OnCommand('deposit')
  async getDepositWallet(@Message() message: IMessage) {
    const user = await UserModel.findOne({ username: message.from.username });
    if (!user) {
      return 'You havent created wallet yet! Please create one with /create_wallet command';
    }
    return `You can deposit funds to ${user.walletPubkey}`;
  }

  @OnClick(/^settings/)
  onSettings() {
    return new MessageSend('Not implemented!');
  }

  @OnClick(/^help/)
  onHelp() {
    return new MessageSend('Not implemented!');
  }

  @OnClick(/^commands/)
  getCommands() {
    const message =
      '/create_wallet - Creates new wallet! \n/play - Lists available pools for betting. \n /deposit - Shows your wallet where you deposit funds!\n /balance - Shows your current balance \n /available_pools - Shows available pools! \n /withdraw - Sends funds to provided wallet';

    return new MessageSend(message);
  }

  @OnClick(/^play/)
  onPlay() {
    return new MessageSend('For placing bet, use /play command!');
  }

  @OnCommand('play')
  async play(ctx): Promise<any> {
    this.state.chatId =
      ctx.message?.chat?.id ?? ctx.callback_query.message.chat.id;
    try {
      const game = await getGameData();
      const parsedPools = game.activePools.map((ac) => ({
        name: `Hamsai ${ac.id}`,
        id: `pool_${ac.id}`,
      }));

      const message = new MessageSend(
        'Choose a pool to bet in:',
        new Keyboard(KeyboardTypes.underTheMessage),
      );

      parsedPools.forEach((pp) => {
        message.keyboard.row(2).btn(pp.name, pp.id);
      });
      return message;
    } catch (error) {
      return new MessageSend('Solana mainnet error!');
    }
  }

  @OnCommand('withdraw')
  async withdrawFunds(
    @Message() message: IMessage,
    @CommandParams() params: string[],
  ) {
    const [wallet, amount] = params;

    if (isNaN(+amount)) {
      return new MessageSend(
        'Invalid withdraw amount! Send command in form /withdraw {wallet} {amount}',
      );
    }

    const {
      message: responseMessage,
      sig,
      success,
    } = await this.appService.withdrawFunds(
      message.from.username,
      +amount,
      wallet,
    );

    if (success) {
      const txLink = `https://solscan.io/tx/${sig}`;

      return new MessageSend(responseMessage).next(txLink);
    } else {
      return new MessageSend(responseMessage);
    }
  }

  @OnClick(/^pool/)
  async choosePool(ctx): Promise<any> {
    const pool = ctx.callback_query.data;

    const match = /^pool_(.*)$/.exec(pool);
    if (!match) {
      return;
    }

    const selectedPool = match[1];

    this.state.selectedPool = selectedPool; // Storing selected pool in state

    return new MessageSend(
      `You've chosen Pool ${selectedPool}. Now, choose your bet amount.`,
      new Keyboard(KeyboardTypes.underTheMessage)
        .row(2)
        .btn('0.05', `bet_${selectedPool}_0.05`)
        .btn('0.1', `bet_${selectedPool}_0.1`)
        .row(2)
        .btn('0.5', `bet_${selectedPool}_0.5`)
        .btn('1', `bet_${selectedPool}_1`)
        .row(2)
        .btn('1.5', `bet_${selectedPool}_1.5`)
        .btn('2', `bet_${selectedPool}_2`)
        .row(2)
        .btn('Other', `bet_other`),
    );
  }

  @OnCommand('bet')
  async handleCustomBet(
    @Message() mess: IMessage,
    @CommandParams() commands: string[],
  ) {
    try {
      const [amount, pool] = commands;
      if (isNaN(+amount) || isNaN(+pool)) {
        return new MessageSend('Invalid params!');
      }

      if (+pool < 1 || +pool > 5) {
        return new MessageSend('Invalid Pool!');
      }

      const { message, success, signature, poolsRecord } =
        await this.appService.handlePlaceBet(
          mess.from.username,
          +pool,
          +amount,
        );
      const txLink = `https://solscan.io/tx/${signature}`;

      let poolsInfo = 'Current pool amounts:\n';
      if (poolsRecord)
        for (const [poolId, poolAmount] of Object.entries(poolsRecord)) {
          poolsInfo += `Pool ${poolId}: ${poolAmount}💰\n`;
        }
      if (success) {
        return new MessageSend(
          `Your bet has been successfully placed.\n\nSolscan tx link: ${txLink}\n\n${poolsRecord}`,
        );
      } else {
        return new MessageSend(message);
      }
    } catch (error) {
      console.log(error);
      return new MessageSend(error.message);
    }
  }

  @OnClick(/^bet_/)
  async chooseBetAmount(ctx, @GetAnswer() answer: Answer): Promise<any> {
    const betInfo = ctx.callback_query.data.split('_');
    if (betInfo.includes('other')) {
      return new MessageSend('For custom bet, type /bet {amount} {pool}');
    }
    if (betInfo.length < 3) {
      return;
    }

    const [_, selectedPool, amount] = betInfo;

    const { message, success, signature, poolsRecord } =
      await this.appService.handlePlaceBet(
        ctx.callback_query.from.username,
        +selectedPool,
        +amount,
      );
    const txLink = `https://solscan.io/tx/${signature}`;

    let poolsInfo = 'Current pool amounts:\n';
    if (poolsRecord)
      for (const [poolId, poolAmount] of Object.entries(poolsRecord)) {
        poolsInfo += `Pool ${poolId}: ${poolAmount}💰\n`;
      }
    if (success) {
      return new MessageSend(
        `Your bet has been successfully placed.\n\nSolscan tx link: ${txLink}\n\n${poolsRecord}`,
      );
    } else {
      return new MessageSend(message);
    }
  }

  @OnClick('availablePools')
  async showAvailablePools(ctx): Promise<any> {
    // Assuming you have a function to get the current pool amounts
    const poolAmounts = {};
    const gameData = await getGameData();
    await Promise.all(
      gameData.activePools.map(async (ac) => {
        const treas = await connection.getBalance(getTreasurySeed(ac.id));

        poolAmounts[ac.id.toString()] = (treas / LAMPORTS_PER_SOL).toString();
      }),
    );
    let messageText =
      '🏊‍♂️ Available Pools 🏊‍♀️\nHere are the pools you can join along with the current betting pool amounts:\n\n';
    for (const [poolId, poolAmount] of Object.entries(poolAmounts)) {
      messageText += `Pool ${poolId}: ${poolAmount}💰\n`;
    }

    return new MessageSend(messageText);
  }

  @OnClick(/^poolI_/)
  async showPoolDetails(ctx): Promise<any> {
    // const poolId = ctx.callback_query.data.split('_')[1];

    const poolDetails = await this.getPoolDetails(2);

    let messageText = `🏊‍♂️ Pool ${2} Details 🏊‍♀️\n\n`;
    messageText += `Current Amount: ${poolDetails.amount}💰\n`;
    messageText += `Number of Participants: ${poolDetails.participants}\n`;
    messageText += `Minimum Bet: ${poolDetails.minBet}\n`;
    messageText += `Maximum Bet: ${poolDetails.maxBet}\n\n`;
    messageText +=
      'Choose an option below to place your bet or return to the pool list.';

    return new MessageSend(
      messageText,
      new Keyboard(KeyboardTypes.underTheMessage).btn(
        'Return to Pool List',
        'availablePools',
      ),
    );
  }

  @OnClick(/^confirm_/)
  async confirmBet(ctx): Promise<any> {
    const betInfo = ctx.callback_query.data.split('_');
    if (betInfo.length < 3) {
      return;
    }

    const [, selectedPool, amount] = betInfo;

    // Use static content for the Solscan transaction link for demonstration purposes
    const txLink = 'https://solscan.io/transaction/EXAMPLE123';

    // Use static content for the pool amounts as well
    const poolAmounts = {
      '1': '100',
      '2': '150',
      '3': '75',
      '4': '200',
    };

    let poolsInfo = 'Current pool amounts:\n';
    for (const [poolId, poolAmount] of Object.entries(poolAmounts)) {
      poolsInfo += `Pool ${poolId}: ${poolAmount}💰\n`;
    }

    return new MessageSend(
      `Your bet has been successfully placed.\n\nSolscan tx link: ${txLink}\n\n${poolsInfo}`,
    );
  }
  @OnCommand('')
  generalCommand() {
    return new MessageSend('Invalid command!');
  }

  @OnText('')
  generalMessage() {
    return '';
  }

  async processBetAndGetTxLink(pool, amount, userId) {
    // Process the bet here (not shown)
    // Generate and return the Solscan transaction link
    const txLink = 'https://solscan.io/tx/yourTransactionId'; // Placeholder link
    return txLink;
  }

  async getPoolDetails(poolId) {
    // Fetch and return details for the specified pool from your database or backend
    // This is a placeholder implementation. You'll need to replace it with actual data retrieval logic.
    return {
      amount: '200',
      participants: 10,
      minBet: '0.05',
      maxBet: '2.00',
    };
  }
}
