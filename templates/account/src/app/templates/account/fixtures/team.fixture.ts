/** One team member row. */
export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatar: string;
  readonly role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  readonly status: 'active' | 'invited';
}

/** Bundled sample team, served until `ACCOUNT_API.baseUrl` is set. */
export const TEAM_FIXTURE: readonly TeamMember[] = [
  { id: 'u1', name: 'Sophie Lang', email: 'sophie@acme.com', avatar: '/demo/avatar-1.svg', role: 'Owner', status: 'active' },
  { id: 'u2', name: 'Marcus Reed', email: 'marcus@acme.com', avatar: '/demo/avatar-2.svg', role: 'Admin', status: 'active' },
  { id: 'u3', name: 'Priya Nair', email: 'priya@acme.com', avatar: '/demo/avatar-3.svg', role: 'Member', status: 'active' },
  { id: 'u4', name: 'Tom Becker', email: 'tom@acme.com', avatar: '/demo/avatar-4.svg', role: 'Member', status: 'active' },
  { id: 'u5', name: 'Ana Souza', email: 'ana@acme.com', avatar: '/demo/avatar-5.svg', role: 'Viewer', status: 'invited' },
];
