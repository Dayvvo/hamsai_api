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
