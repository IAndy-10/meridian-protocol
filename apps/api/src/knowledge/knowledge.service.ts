import { Injectable, Logger } from '@nestjs/common';
import { OrgRole, KnowledgeDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { HydraDbService } from './hydra-db.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import {
  KnowledgeDocumentResponseDto,
  KnowledgeDocumentListResponseDto,
  KnowledgeQueryResultDto,
} from './dto/knowledge-response.dto';
import {
  KnowledgeAccessDeniedException,
  KnowledgeDocumentNotFoundException,
  HydraDbNotConfiguredException,
} from './exceptions/knowledge.exceptions';

@Injectable()
export class KnowledgeService {
  private static readonly WRITE_ROLES: OrgRole[] = [
    OrgRole.OWNER,
    OrgRole.ADMIN,
    OrgRole.MEMBER,
  ];

  private static readonly MANAGE_ROLES: OrgRole[] = [
    OrgRole.OWNER,
    OrgRole.ADMIN,
  ];

  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly hydraDb: HydraDbService,
  ) {}

  private databaseName(organizationId: string): string {
    return `org_${organizationId.replace(/-/g, '_')}`;
  }

  private collectionName(): string {
    return 'knowledge';
  }

  private requireConfigured(): void {
    if (!this.hydraDb.isConfigured) {
      throw new HydraDbNotConfiguredException();
    }
  }

  async ingest(
    userId: string,
    organizationId: string,
    data: IngestDocumentDto,
  ): Promise<KnowledgeDocumentResponseDto> {
    this.requireConfigured();
    await this.requireRole(userId, organizationId, KnowledgeService.WRITE_ROLES, 'ingest');

    const database = this.databaseName(organizationId);
    const collection = this.collectionName();

    await this.hydraDb.ensureDatabase(database);

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        organizationId,
        createdById: userId,
        title: data.title,
        hydraSourceId: '',
        indexingStatus: 'pending',
      },
    });

    try {
      const sourceIds = await this.hydraDb.ingestDocument(database, collection, {
        id: doc.id,
        title: data.title,
        content: data.content,
        metadata: data.metadata,
      });

      const updatedDoc = await this.prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: {
          hydraSourceId: sourceIds[0] ?? doc.id,
          indexingStatus: 'indexing',
        },
      });

      return this.toResponse(updatedDoc);
    } catch (error) {
      await this.prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { indexingStatus: 'failed' },
      });
      throw error;
    }
  }

  async list(
    userId: string,
    organizationId: string,
  ): Promise<KnowledgeDocumentListResponseDto> {
    await this.requireRole(userId, organizationId, KnowledgeService.WRITE_ROLES, 'list');

    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: docs.map((doc) => this.toResponse(doc)),
      total: docs.length,
    };
  }

  async findOne(
    userId: string,
    organizationId: string,
    documentId: string,
  ): Promise<KnowledgeDocumentResponseDto> {
    await this.requireRole(userId, organizationId, KnowledgeService.WRITE_ROLES, 'view');
    const doc = await this.loadScoped(organizationId, documentId);
    return this.toResponse(doc);
  }

  async refreshStatus(
    userId: string,
    organizationId: string,
    documentId: string,
  ): Promise<KnowledgeDocumentResponseDto> {
    this.requireConfigured();
    await this.requireRole(userId, organizationId, KnowledgeService.WRITE_ROLES, 'view');
    const doc = await this.loadScoped(organizationId, documentId);

    if (doc.indexingStatus === 'completed' || doc.indexingStatus === 'failed') {
      return this.toResponse(doc);
    }

    const database = this.databaseName(organizationId);
    const status = await this.hydraDb.getIndexingStatus(database, [doc.hydraSourceId]);
    const hydraStatus = status.data.statuses[0]?.indexing_status ?? doc.indexingStatus;

    const updatedDoc = await this.prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { indexingStatus: hydraStatus },
    });

    return this.toResponse(updatedDoc);
  }

  async query(
    userId: string,
    organizationId: string,
    queryText: string,
    options?: { graphContext?: boolean; maxResults?: number },
  ): Promise<KnowledgeQueryResultDto> {
    this.requireConfigured();
    await this.requireRole(userId, organizationId, KnowledgeService.WRITE_ROLES, 'query');

    const database = this.databaseName(organizationId);
    const collection = this.collectionName();

    const result = await this.hydraDb.query(database, collection, queryText, options);

    return {
      chunks: (result.data.chunks ?? []).map((chunk) => ({
        text: chunk.text,
        sourceId: chunk.source_id,
        score: chunk.score,
      })),
      graphContext: result.data.graph_context
        ? {
            queryPaths: result.data.graph_context.query_paths ?? [],
            chunkRelations: result.data.graph_context.chunk_relations ?? [],
          }
        : undefined,
    };
  }

  async remove(
    userId: string,
    organizationId: string,
    documentId: string,
  ): Promise<void> {
    this.requireConfigured();
    await this.requireRole(userId, organizationId, KnowledgeService.MANAGE_ROLES, 'delete');
    const doc = await this.loadScoped(organizationId, documentId);

    const database = this.databaseName(organizationId);
    const collection = this.collectionName();

    try {
      await this.hydraDb.deleteSource(database, collection, [doc.hydraSourceId]);
    } catch (error) {
      this.logger.warn(
        `Failed to delete source ${doc.hydraSourceId} from HydraDB: ${error}`,
      );
    }

    await this.prisma.knowledgeDocument.delete({ where: { id: doc.id } });
  }

  private async loadScoped(
    organizationId: string,
    documentId: string,
  ): Promise<KnowledgeDocument> {
    const doc = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!doc) {
      throw new KnowledgeDocumentNotFoundException(documentId);
    }

    return doc;
  }

  private async requireRole(
    userId: string,
    organizationId: string,
    allowed: OrgRole[],
    action: string,
  ): Promise<OrgRole> {
    const role = await this.organizationsService.getUserRoleInOrganization(
      userId,
      organizationId,
    );

    if (!role || !allowed.includes(role)) {
      throw new KnowledgeAccessDeniedException(action);
    }

    return role;
  }

  private toResponse(doc: KnowledgeDocument): KnowledgeDocumentResponseDto {
    return {
      id: doc.id,
      organizationId: doc.organizationId,
      createdById: doc.createdById,
      title: doc.title,
      hydraSourceId: doc.hydraSourceId,
      indexingStatus: doc.indexingStatus,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
