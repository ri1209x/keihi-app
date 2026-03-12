export type AppRole = "operator" | "approver" | "admin";

export type DemoUser = {
  id: string;
  displayName: string;
  organizationId: string;
  role: AppRole;
  defaultClientId: string;
};

const DEMO_USERS: DemoUser[] = [
  {
    id: "operator",
    displayName: "経理担当",
    organizationId: "demo-tenant",
    role: "operator",
    defaultClientId: "demo-client",
  },
  {
    id: "approver",
    displayName: "承認者",
    organizationId: "demo-tenant",
    role: "approver",
    defaultClientId: "demo-client",
  },
  {
    id: "admin",
    displayName: "管理者",
    organizationId: "demo-tenant",
    role: "admin",
    defaultClientId: "demo-client",
  },
  {
    id: "other-operator",
    displayName: "別テナント担当",
    organizationId: "other-tenant",
    role: "operator",
    defaultClientId: "other-client",
  },
];

export function listDemoUsers(): DemoUser[] {
  return DEMO_USERS;
}

export function getDemoUserById(userId: string): DemoUser | null {
  return DEMO_USERS.find((user) => user.id === userId) ?? null;
}
