import {
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';

export class ReconciliationRunNotFoundException extends NotFoundException {
  constructor(runId: string) {
    super(`Reconciliation run not found: ${runId}`);
  }
}

export class ReconciliationAccessDeniedException extends ForbiddenException {
  constructor(action: string) {
    super(`You do not have permission to ${action} reconciliation runs`);
  }
}

export class ReconciliationEngineNotReadyException extends NotImplementedException {
  constructor() {
    super('Reconciliation engine is not yet available. Phase B pending.');
  }
}
