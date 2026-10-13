import { Injectable, Logger } from '@nestjs/common';
import { OrgRole, SourceArtifact } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { HydraDbService } from '../knowledge/hydra-db.service';
import {
  SourceArtifactResponseDto,
  SourceArtifactDetailDto,
  SourceArtifactListDto,
} from './dto/source-response.dto';
import {
  SourceArtifactNotFoundException,
  SourcesAccessDeniedException,
} from './exceptions/sources.exceptions';

@Injectable()
export class SourcesService {
  private static readonly ALLOWED_ROLES: OrgRole[] = [
    OrgRole.OWNER,
    OrgRole.ADMIN,
    OrgRole.MEMBER,
  ];

  private static readonly HYDRA_COLLECTION = 'source_artifacts';

  private readonly logger = new Logger(SourcesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly hydraDb: HydraDbService,
  ) {}

  async list(
    userId: string,
    organizationId: string,
  ): Promise<SourceArtifactListDto> {
    await this.requireRole(userId, organizationId, 'list');

    const artifacts = await this.prisma.sourceArtifact.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: artifacts.map((a) => this.toResponse(a)),
      total: artifacts.length,
    };
  }

  async findOne(
    userId: string,
    organizationId: string,
    id: string,
  ): Promise<SourceArtifactDetailDto> {
    await this.requireRole(userId, organizationId, 'view');
    const artifact = await this.loadScoped(organizationId, id);

    const detail: SourceArtifactDetailDto = {
      ...this.toResponse(artifact),
      storedText: artifact.storedText,
    };

    // Retrieve full text from HydraDB if available
    if (artifact.hydraSourceId && this.hydraDb.isConfigured) {
      try {
        const dbName = this.databaseName(organizationId);
        const result = await this.hydraDb.query(
          dbName,
          SourcesService.HYDRA_COLLECTION,
          artifact.title,
          { graphContext: false, maxResults: 5 },
        );
        detail.hydraChunks = (result.data.chunks ?? [])
          .filter((c) => c.source_id === artifact.hydraSourceId)
          .map((c) => ({
            text: c.text,
            sourceId: c.source_id,
            score: c.score,
          }));
      } catch (error) {
        this.logger.warn(
          `Failed to retrieve HydraDB chunks for source ${id}: ${error}`,
        );
      }
    }

    return detail;
  }

  async search(
    userId: string,
    organizationId: string,
    queryText: string,
    maxResults?: number,
  ): Promise<{ chunks: Array<{ text: string; sourceId: string; score: number }> }> {
    await this.requireRole(userId, organizationId, 'search');

    if (!this.hydraDb.isConfigured) {
      return { chunks: [] };
    }

    const dbName = this.databaseName(organizationId);

    try {
      const result = await this.hydraDb.query(
        dbName,
        SourcesService.HYDRA_COLLECTION,
        queryText,
        { graphContext: false, maxResults: maxResults ?? 10 },
      );

      return {
        chunks: (result.data.chunks ?? []).map((c) => ({
          text: c.text,
          sourceId: c.source_id,
          score: c.score,
        })),
      };
    } catch (error) {
      this.logger.error(`HydraDB search failed for org ${organizationId}: ${error}`);
      throw error;
    }
  }

  private databaseName(organizationId: string): string {
    return `org_${organizationId.replace(/-/g, '_')}`;
  }

  private async loadScoped(
    organizationId: string,
    id: string,
  ): Promise<SourceArtifact> {
    const artifact = await this.prisma.sourceArtifact.findFirst({
      where: { id, organizationId },
    });

    if (!artifact) {
      throw new SourceArtifactNotFoundException(id);
    }

    return artifact;
  }

  private async requireRole(
    userId: string,
    organizationId: string,
    action: string,
  ): Promise<void> {
    const role = await this.organizationsService.getUserRoleInOrganization(
      userId,
      organizationId,
    );

    if (!role || !SourcesService.ALLOWED_ROLES.includes(role)) {
      throw new SourcesAccessDeniedException(action);
    }
  }

  private toResponse(artifact: SourceArtifact): SourceArtifactResponseDto {
    return {
      id: artifact.id,
      organizationId: artifact.organizationId,
      kind: artifact.kind,
      title: artifact.title,
      url: artifact.url,
      excerpt: artifact.excerpt,
      sectionLocator: artifact.sectionLocator,
      contentHash: artifact.contentHash,
      hydraSourceId: artifact.hydraSourceId,
      createdAt: artifact.createdAt.toISOString(),
    };
  }
}
