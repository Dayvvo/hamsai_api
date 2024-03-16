import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection } from '@solana/web3.js';

export const ConnectionProvider: Provider = {
  inject: [ConfigService],
  provide: 'CONNECTION',
  useFactory(configService: ConfigService) {
    return new Connection(configService.get('RPC_CONNECTION'), 'confirmed');
  },
};
