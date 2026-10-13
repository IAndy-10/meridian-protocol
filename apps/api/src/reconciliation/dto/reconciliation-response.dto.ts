export class ReconciliationRunSummaryDto {
  id: string;
  organizationId: string;
  configurationHash: string;
  engineVersion: string;
  asOf: string;
  extractionHash: string;
  summaryJson: unknown;
  createdAt: string;
}

export class ReconciliationRunDetailDto extends ReconciliationRunSummaryDto {
  decisionsJson: unknown;
}

export class ReconciliationRunListDto {
  items: ReconciliationRunSummaryDto[];
  total: number;
}
