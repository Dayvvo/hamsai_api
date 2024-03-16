import { Module } from '@nestjs/common';
import { PoolConfiguratorService } from './pool_configurator.service';
import { PoolConfiguratorController } from './pool_configurator.controller';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PoolConfiguratorController],
  providers: [PoolConfiguratorService],
})
export class PoolConfiguratorModule {}
