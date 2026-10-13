import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { HydraDbService } from './hydra-db.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [PrismaModule, OrganizationsModule, ConfigModule],
  controllers: [KnowledgeController],
  providers: [HydraDbService, KnowledgeService],
  exports: [KnowledgeService, HydraDbService],
})
export class KnowledgeModule {}
