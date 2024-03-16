import { Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Program, AnchorProvider, Wallet } from '@project-serum/anchor';
import { Connection, Keypair } from '@solana/web3.js';
import { Hamsai as HamsaiType, IDL } from '../pool_configurator/idl/hamsai';
import { decode } from 'bs58';

export type Hamsai = Program<HamsaiType>;
export const HamsaiProvider: Provider = {
  provide: 'HAMSAI',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return new Program<HamsaiType>(
      IDL,
      configService.get('HAMSAI_PROGRAM_ID'),
      new AnchorProvider(
        new Connection(configService.get('RPC_CONNECTION'), 'confirmed'),
        new Wallet(
          Keypair.fromSecretKey(decode(configService.get('AUTHORITY_KEY'))),
        ),
        {},
      ),
    );
  },
};
