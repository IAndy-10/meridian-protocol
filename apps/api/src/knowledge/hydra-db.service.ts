import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface HydraDbStatus {
  data: {
    infra: {
      ready_for_ingestion: boolean;
    };
  };
}

interface HydraIngestResponse {
  data: {
    source_ids: string[];
  };
}

interface HydraIndexingStatus {
  data: {
    statuses: Array<{
      id: string;
      indexing_status: string;
    }>;
  };
}

interface HydraQueryChunk {
  text: string;
  source_id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface HydraQueryResult {
  data: {
    chunks: HydraQueryChunk[] | null;
    graph_context?: {
      query_paths: unknown[] | null;
      chunk_relations: unknown[] | null;
    };
  };
}

@Injectable()
export class HydraDbService implements OnModuleInit {
  private readonly logger = new Logger(HydraDbService.name);
  private readonly baseUrl = 'https://api.hydradb.com';
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('HYDRA_DB_API_KEY', '');
  }

  onModuleInit() {
    if (!this.apiKey) {
      this.logger.warn(
        'HYDRA_DB_API_KEY is not set. Knowledge features will be unavailable.',
      );
    }
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'API-Version': '2',
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `HydraDB ${method} ${path} failed (${response.status}): ${text}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async requestFormData<T>(
    path: string,
    formData: FormData,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'API-Version': '2',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `HydraDB POST ${path} failed (${response.status}): ${text}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async createDatabase(database: string): Promise<void> {
    try {
      await this.request('POST', '/databases', { database });
      this.logger.log(`Created HydraDB database: ${database}`);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('409') || error.message.includes('conflict'))
      ) {
        this.logger.log(`HydraDB database already exists: ${database}`);
        return;
      }
      throw error;
    }
  }

  async getDatabaseStatus(database: string): Promise<HydraDbStatus> {
    return this.request<HydraDbStatus>(
      'GET',
      `/databases/status?database=${encodeURIComponent(database)}`,
    );
  }

  async waitForDatabase(database: string, maxWaitMs = 60_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const status = await this.getDatabaseStatus(database);
      if (status.data.infra.ready_for_ingestion) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error(
      `HydraDB database ${database} not ready after ${maxWaitMs}ms`,
    );
  }

  async ensureDatabase(database: string): Promise<void> {
    await this.createDatabase(database);
    await this.waitForDatabase(database);
  }

  async ingestDocument(
    database: string,
    collection: string,
    doc: { id: string; title: string; content: string; metadata?: Record<string, unknown> },
  ): Promise<string[]> {
    const formData = new FormData();
    formData.append('database', database);
    formData.append('collection', collection);
    formData.append('type', 'knowledge');
    formData.append('upsert', 'true');

    const blob = new Blob([doc.content], { type: 'text/plain' });
    formData.append('documents', blob, `${doc.id}.md`);

    const docMetadata = [
      {
        id: doc.id,
        title: doc.title,
        ...(doc.metadata
          ? { additional_metadata: doc.metadata }
          : {}),
      },
    ];
    formData.append('document_metadata', JSON.stringify(docMetadata));

    const result = await this.requestFormData<HydraIngestResponse>(
      '/context/ingest',
      formData,
    );
    return result.data.source_ids;
  }

  async getIndexingStatus(
    database: string,
    ids: string[],
  ): Promise<HydraIndexingStatus> {
    const idsParam = ids.map((id) => `ids=${encodeURIComponent(id)}`).join('&');
    return this.request<HydraIndexingStatus>(
      'GET',
      `/context/status?database=${encodeURIComponent(database)}&${idsParam}`,
    );
  }

  async query(
    database: string,
    collection: string,
    queryText: string,
    options?: {
      graphContext?: boolean;
      maxResults?: number;
    },
  ): Promise<HydraQueryResult> {
    const graphContext = options?.graphContext ?? true;
    return this.request<HydraQueryResult>('POST', '/query', {
      database,
      collection,
      query: queryText,
      type: 'knowledge',
      query_by: 'hybrid',
      graph_context: graphContext,
      mode: graphContext ? 'thinking' : 'fast',
      max_results: options?.maxResults ?? 10,
    });
  }

  async deleteSource(
    database: string,
    collection: string,
    ids: string[],
  ): Promise<void> {
    await this.request('DELETE', '/context', {
      database,
      collection,
      ids,
      type: 'knowledge',
    });
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }
}
