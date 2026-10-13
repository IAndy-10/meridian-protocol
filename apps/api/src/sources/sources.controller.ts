import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TokenPayload } from '@app-starter/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { SourcesService } from './sources.service';
import { SearchSourcesDto, ProvenanceSearchDto } from './dto/search-sources.dto';
import {
  SourceArtifactDetailDto,
  SourceArtifactListDto,
} from './dto/source-response.dto';

@ApiTags('sources')
@Controller('organizations/:organizationId/sources')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List source artifacts for an organization' })
  async list(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<SourceArtifactListDto> {
    return this.sourcesService.list(req.user.sub, organizationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a source artifact with HydraDB full text' })
  async findOne(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<SourceArtifactDetailDto> {
    return this.sourcesService.findOne(req.user.sub, organizationId, id);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hybrid search across source artifacts via HydraDB' })
  async search(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: SearchSourcesDto,
  ): Promise<{ chunks: Array<{ text: string; sourceId: string; score: number }> }> {
    return this.sourcesService.search(
      req.user.sub,
      organizationId,
      data.query,
      data.maxResults,
    );
  }

  @Post('provenance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Find source passages that ground a reconciliation decision' })
  async provenance(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: ProvenanceSearchDto,
  ): Promise<Array<{ text: string; sourceId: string; score: number; title: string }>> {
    return this.sourcesService.provenanceSearch(
      req.user.sub,
      organizationId,
      data.reasonCodes,
      data.reasonText,
    );
  }
}
