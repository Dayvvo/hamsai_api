import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Bet } from './bet.model';

@Schema()
export class UserBet {
  @Prop({ type: mongoose.Types.ObjectId, ref: 'Bet' })
  bet: mongoose.Types.ObjectId;
  @Prop()
  betAmount: number;
  @Prop()
  poolId: number;
}

@Schema()
export class User {
  @Prop()
  username: string;
  @Prop()
  walletKeypair: string;
  @Prop()
  walletPubkey: string;
  @Prop()
  totalBets: number;
  @Prop()
  totalEarnings: number;
  @Prop()
  spentFunds: number;
  @Prop()
  earnedFunds: number;
  @Prop({ type: [UserBet] })
  bets: UserBet[];
}

export const UserSchema = SchemaFactory.createForClass(User);
export const UserModel = mongoose.model('user', UserSchema);

export enum RaceState {
  Betting,
  Racing,
  Finished,
}

@Schema()
export class Race {
  @Prop({ enum: RaceState })
  state: RaceState;
  @Prop()
  updatedAt: Date;
}

export const RaceSchema = SchemaFactory.createForClass(Race);

export const RaceModel = mongoose.model('race', RaceSchema);
