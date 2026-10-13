import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

export class KnowledgeDocumentNotFoundException extends NotFoundException {
  constructor(identifier: string) {
    super(`Knowledge document not found: ${identifier}`);
  }
}

export class KnowledgeAccessDeniedException extends ForbiddenException {
  constructor(action: string) {
    super(`You do not have permission to ${action} knowledge documents`);
  }
}

export class HydraDbNotConfiguredException extends ServiceUnavailableException {
  constructor() {
    super(
      'Knowledge features are unavailable. HYDRA_DB_API_KEY is not configured.',
    );
  }
}
