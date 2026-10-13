import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TokenPayload } from '@app-starter/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { KnowledgeService } from './knowledge.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import {
  KnowledgeDocumentListResponseDto,
  KnowledgeDocumentResponseDto,
  KnowledgeQueryResultDto,
} from './dto/knowledge-response.dto';

@ApiTags('knowledge')
@Controller('organizations/:organizationId/knowledge')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest a document into the knowledge base' })
  @ApiResponse({ status: 201, description: 'Document ingested' })
  async ingest(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: IngestDocumentDto,
  ): Promise<KnowledgeDocumentResponseDto> {
    return this.knowledgeService.ingest(req.user.sub, organizationId, data);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all knowledge documents' })
  async list(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<KnowledgeDocumentListResponseDto> {
    return this.knowledgeService.list(req.user.sub, organizationId);
  }

  @Get(':documentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single knowledge document' })
  async findOne(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
  ): Promise<KnowledgeDocumentResponseDto> {
    return this.knowledgeService.findOne(req.user.sub, organizationId, documentId);
  }

  @Post(':documentId/refresh-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh the indexing status from HydraDB' })
  async refreshStatus(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
  ): Promise<KnowledgeDocumentResponseDto> {
    return this.knowledgeService.refreshStatus(req.user.sub, organizationId, documentId);
  }

  @Post('query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Query the knowledge base' })
  async query(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: QueryKnowledgeDto,
  ): Promise<KnowledgeQueryResultDto> {
    return this.knowledgeService.query(
      req.user.sub,
      organizationId,
      data.query,
      {
        graphContext: data.graphContext,
        maxResults: data.maxResults,
      },
    );
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a knowledge document (OWNER or ADMIN)' })
  async remove(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.knowledgeService.remove(req.user.sub, organizationId, documentId);
  }
}
