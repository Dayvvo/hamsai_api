import { Controller } from '@nestjs/common';
import { PoolConfiguratorService } from './pool_configurator.service';

@Controller('pool-configurator')
export class PoolConfiguratorController {
  constructor(private readonly poolConfiguratorService: PoolConfiguratorService) {}
}
