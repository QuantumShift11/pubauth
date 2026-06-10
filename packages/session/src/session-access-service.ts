import type { AssignmentRepository, UserRepository } from '../../storage/src/index.js';
import type { StoredAssignment, StoredUserAccount } from '../../storage/src/pubauth-state.js';

export interface SessionAccessPrincipal {
  subjectId: string;
  workspaceId: string;
  username: string;
  roles: string[];
}

export class SessionAccessService {
  constructor(
    private readonly users: UserRepository<StoredUserAccount>,
    private readonly assignments: AssignmentRepository<StoredAssignment>,
  ) {}

  async resolve(subjectId: string, workspaceId: string): Promise<SessionAccessPrincipal | null> {
    const [user, assignments] = await Promise.all([
      this.users.findBySubjectId(subjectId),
      this.assignments.list(),
    ]);

    if (!user || user.workspaceId !== workspaceId) {
      return null;
    }

    const roles = assignments
      .filter((assignment) => assignment.userId === subjectId)
      .filter((assignment) => !assignment.workspaceId || assignment.workspaceId === workspaceId)
      .map((assignment) => assignment.role);

    return {
      subjectId,
      workspaceId,
      username: user.username,
      roles: [...new Set(roles)],
    };
  }

  async hasAnyRole(subjectId: string, workspaceId: string, requiredRoles: string[]): Promise<boolean> {
    const principal = await this.resolve(subjectId, workspaceId);
    if (!principal) {
      return false;
    }

    return requiredRoles.some((role) => principal.roles.includes(role));
  }
}
