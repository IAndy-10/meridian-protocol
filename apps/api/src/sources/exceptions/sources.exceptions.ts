import { ForbiddenException, NotFoundException } from '@nestjs/common';

export class SourceArtifactNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Source artifact not found: ${id}`);
  }
}

export class SourcesAccessDeniedException extends ForbiddenException {
  constructor(action: string) {
    super(`You do not have permission to ${action} source artifacts`);
  }
}
