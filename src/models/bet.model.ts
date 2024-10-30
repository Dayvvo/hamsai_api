import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

export enum BetStatus {
  Created = 'created',
  Started = 'started',
  Finished = 'finished',
}

@Schema()
export class PoolBets {
  poolId: number;
  totalBets: number;
  totalSol: number;
}

@Schema()
export class Bet {
  @Prop()
  createdBy: string;
  @Prop()
  createdAt: Date;
  @Prop({ type: String, enum: BetStatus })
  status: BetStatus;
  @Prop()
  endsAt: Date;
  @Prop({ type: [PoolBets] })
  bets: PoolBets[];
  @Prop()
  winningPool: number;
}

const BetSchema = SchemaFactory.createForClass(Bet);

export const BetModel = mongoose.model('bet', BetSchema);
