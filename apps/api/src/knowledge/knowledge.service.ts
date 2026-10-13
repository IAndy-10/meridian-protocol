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
      const enrichedMetadata: Record<string, unknown> = {
        ...data.metadata,
        ...(data.artifactKind && { artifact_kind: data.artifactKind }),
        ...(data.linkedProtocolVersions?.length && { linked_protocol_versions: data.linkedProtocolVersions }),
        ...(data.topicTags?.length && { topic_tags: data.topicTags }),
        ...(data.publicationDate && { publication_date: data.publicationDate }),
        ...(data.sectionHeading && { section_heading: data.sectionHeading }),
      };

      const sourceIds = await this.hydraDb.ingestDocument(database, collection, {
        id: doc.id,
        title: data.title,
        content: data.content,
        metadata: Object.keys(enrichedMetadata).length > 0 ? enrichedMetadata : undefined,
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

    const graphCtx = result.data.graph_context;
    return {
      chunks: (result.data.chunks ?? []).map((chunk) => ({
        text: chunk.text,
        sourceId: chunk.source_id,
        score: chunk.score,
      })),
      graphContext: graphCtx
        ? {
            queryPaths: (graphCtx.query_paths ?? []).map((p: any) => ({
              from: String(p.from ?? p.source ?? ''),
              to: String(p.to ?? p.target ?? ''),
              relation: String(p.relation ?? p.type ?? 'related'),
              weight: Number(p.weight ?? p.score ?? 1),
            })),
            chunkRelations: (graphCtx.chunk_relations ?? []).map((r: any) => ({
              sourceChunkId: String(r.source_chunk_id ?? r.source ?? ''),
              targetChunkId: String(r.target_chunk_id ?? r.target ?? ''),
              relation: String(r.relation ?? r.type ?? 'related'),
              sourceText: r.source_text,
              targetText: r.target_text,
            })),
          }
        : undefined,
    };
  }

  async unifiedSearch(
    userId: string,
    organizationId: string,
    queryText: string,
    maxResults?: number,
  ): Promise<{
    results: Array<{
      text: string;
      sourceId: string;
      score: number;
      collection: string;
    }>;
    connections: Array<{
      from: string;
      to: string;
      relation: string;
    }>;
  }> {
    this.requireConfigured();
    await this.requireRole(userId, organizationId, KnowledgeService.WRITE_ROLES, 'query');

    const database = this.databaseName(organizationId);
    const limit = maxResults ?? 10;

    const [knowledgeResult, sourcesResult] = await Promise.allSettled([
      this.hydraDb.query(database, 'knowledge', queryText, {
        graphContext: true,
        maxResults: limit,
      }),
      this.hydraDb.query(database, 'source_artifacts', queryText, {
        graphContext: true,
        maxResults: limit,
      }),
    ]);

    const results: Array<{
      text: string;
      sourceId: string;
      score: number;
      collection: string;
    }> = [];

    if (knowledgeResult.status === 'fulfilled') {
      for (const chunk of knowledgeResult.value.data.chunks ?? []) {
        results.push({
          text: chunk.text,
          sourceId: chunk.source_id,
          score: chunk.score,
          collection: 'knowledge',
        });
      }
    }

    if (sourcesResult.status === 'fulfilled') {
      for (const chunk of sourcesResult.value.data.chunks ?? []) {
        results.push({
          text: chunk.text,
          sourceId: chunk.source_id,
          score: chunk.score,
          collection: 'source_artifacts',
        });
      }
    }

    // Extract connections from graph context
    const connections: Array<{ from: string; to: string; relation: string }> = [];
    for (const settledResult of [knowledgeResult, sourcesResult]) {
      if (settledResult.status === 'fulfilled') {
        const gc = settledResult.value.data.graph_context;
        if (gc?.query_paths) {
          for (const p of gc.query_paths as any[]) {
            connections.push({
              from: String(p.from ?? p.source ?? ''),
              to: String(p.to ?? p.target ?? ''),
              relation: String(p.relation ?? p.type ?? 'related'),
            });
          }
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return { results: results.slice(0, limit), connections };
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
