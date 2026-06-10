import type {
  AssignmentRepository,
  AuditRepository,
  SessionRepository,
  UserRepository,
} from '../../storage/src/index.js';
import type {
  StoredAssignment,
  StoredAuditEvent,
  StoredAuthSession,
  StoredUserAccount,
} from '../../storage/src/pubauth-state.js';

export interface SelfServiceOverview {
  user: {
    subjectId: string;
    username: string;
    displayName: string;
    email: string;
    workspaceId: string;
    roles: string[];
  };
  sessions: StoredAuthSession[];
  recentAuditEvents: StoredAuditEvent[];
}

export class SelfServiceProfileService {
  constructor(
    private readonly users: UserRepository<StoredUserAccount>,
    private readonly sessions: SessionRepository<StoredAuthSession>,
    private readonly assignments: AssignmentRepository<StoredAssignment>,
    private readonly audit: AuditRepository<StoredAuditEvent>,
  ) {}

  async getOverview(subjectId: string, workspaceId: string): Promise<SelfServiceOverview> {
    const [user, sessions, assignments, recentAuditEvents] = await Promise.all([
      this.users.findBySubjectId(subjectId),
      this.sessions.list(),
      this.assignments.list(),
      this.audit.listRecent(100),
    ]);

    if (!user) {
      throw new Error('user_not_found');
    }

    const roles = assignments
      .filter((assignment) => assignment.userId === subjectId)
      .filter((assignment) => !assignment.workspaceId || assignment.workspaceId === workspaceId)
      .map((assignment) => assignment.role);

    return {
      user: {
        subjectId: user.subjectId,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        workspaceId: user.workspaceId,
        roles: [...new Set(roles)],
      },
      sessions: sessions
        .filter((session) => session.subjectId === subjectId && session.workspaceId === workspaceId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      recentAuditEvents: recentAuditEvents
        .filter((event) => event.actor === subjectId || event.workspaceId === workspaceId)
        .slice(0, 20),
    };
  }
}
