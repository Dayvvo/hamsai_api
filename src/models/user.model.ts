import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

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
