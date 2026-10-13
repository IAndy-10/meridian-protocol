import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TokenPayload } from '@app-starter/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { ReconciliationService } from './reconciliation.service';
import { TriggerRunDto } from './dto/trigger-run.dto';
import { ExportRunQueryDto } from './dto/export-run.dto';
import {
  ReconciliationRunDetailDto,
  ReconciliationRunListDto,
} from './dto/reconciliation-response.dto';

@ApiTags('reconciliation')
@Controller('organizations/:organizationId/reconciliation')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Trigger a new reconciliation run (Phase B stub)' })
  async triggerRun(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: TriggerRunDto,
  ): Promise<ReconciliationRunDetailDto> {
    return this.reconciliationService.triggerRun(
      req.user.sub,
      organizationId,
      data.protocolVersionId,
      data.coverageManifestId,
    );
  }

  @Get('runs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List reconciliation runs' })
  async listRuns(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<ReconciliationRunListDto> {
    return this.reconciliationService.listRuns(req.user.sub, organizationId);
  }

  @Get('runs/:runId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a reconciliation run with full decisions' })
  async getRun(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('runId') runId: string,
  ): Promise<ReconciliationRunDetailDto> {
    return this.reconciliationService.getRun(req.user.sub, organizationId, runId);
  }

  @Get('runs/:runId/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export a reconciliation run as JSON or CSV' })
  async exportRun(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('runId') runId: string,
    @Query() query: ExportRunQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.reconciliationService.exportRun(
      req.user.sub,
      organizationId,
      runId,
      query.format,
    );

    res.setHeader('Content-Type', result.contentType);
    if (query.format === 'csv') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reconciliation-${runId}.csv"`,
      );
    }
    res.send(result.data);
  }
}
