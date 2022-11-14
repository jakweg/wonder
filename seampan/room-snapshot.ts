export const enum MemberPermissions {
  None = 0,
  InvokeOperation = 1 << 0,
  SendGameState = 1 << 1,
  LockRoom = 1 << 2,
  SetLatencyMilliseconds = 1 << 3,
  SendInputActions = 1 << 4,
  ReceiveInputActions = 1 << 5,
}

export const MemberRole: MemberPermissions =
  MemberPermissions.None |
  MemberPermissions.InvokeOperation |
  MemberPermissions.SendInputActions |
  MemberPermissions.ReceiveInputActions;

export const OwnerRole: MemberPermissions =
  MemberRole |
  MemberPermissions.InvokeOperation |
  MemberPermissions.SendGameState |
  MemberPermissions.LockRoom |
  MemberPermissions.SetLatencyMilliseconds;

export const can = (
  role: MemberPermissions | undefined,
  testFor: MemberPermissions
): boolean => {
  return role === undefined ? false : (role & testFor) === testFor;
};

export type PlayerInRoom = { role: MemberPermissions };

export interface RoomSnapshot {
  id: string;
  preventJoining: boolean;
  latencyMs: number;
  players: { [key: string]: PlayerInRoom };
}
