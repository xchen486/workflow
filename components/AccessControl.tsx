
import { User, UserRole, DataStatus, TableRow, AccessLevel, Workspace } from '../types';

/**
 * 获取某个用户的所有下属（递归）
 */
const getAllSubordinates = (leaderId: string, allUsers: User[]): string[] => {
  const direct = allUsers.filter(u => u.managerId === leaderId).map(u => u.id);
  let all: string[] = [...direct];
  direct.forEach(subId => {
    all = [...all, ...getAllSubordinates(subId, allUsers)];
  });
  return all;
};

/**
 * 检查用户是否是特定工作区的管理员
 */
export const isWorkspaceAdmin = (user: User, workspace: Workspace): boolean => {
  if (user.role === UserRole.ADMIN) return true; // 全局管理员也是工作区管理员
  return workspace.adminIds?.includes(user.id) || false;
};

/**
 * 行级权限控制：决定用户是否有权看到这一行数据
 */
export const canViewRow = (user: User, row: TableRow, allUsers: User[], workspace?: Workspace): boolean => {
  // 1. 系统管理员：全局可见
  if (user.role === UserRole.ADMIN) return true;

  // 2. 工作区管理员：对该工作区数据全权可见
  // 注意：需要调用方传入 workspace 上下文
  if (workspace && isWorkspaceAdmin(user, workspace)) return true;
  
  // 3. 本人数据：始终可见
  if (user.id === row.ownerId) return true;
  
  // 4. 管理者逻辑：可见下属的所有数据
  if (user.role === UserRole.LEADER) {
    const subordinateIds = getAllSubordinates(user.id, allUsers);
    if (subordinateIds.includes(row.ownerId)) return true;
  }
  
  return false; 
};

/**
 * 列级权限控制（权限矩阵核心）
 */
export const getColumnAccess = (
  user: User,
  row: TableRow,
  field: string,
  workspace: Workspace
): AccessLevel => {
  // 1. 管理员（全局或工作区）拥有最高写权限
  if (isWorkspaceAdmin(user, workspace)) return AccessLevel.WRITE;
  
  if (field === 'status') return AccessLevel.WRITE;

  const metaFields = ['id', 'updatedAt', 'ownerId', 'version'];
  if (metaFields.includes(field)) return AccessLevel.READ;

  const column = workspace.columns.find(c => c.field === field);
  if (!column) return AccessLevel.NONE;

  const userGroupId = user.groupId;
  const configuredPermission = column.groupPermissions?.[userGroupId];

  let permission = configuredPermission || AccessLevel.NONE;

  // 状态流转逻辑：即使有写权限，在特定状态下也被锁定
  if (permission === AccessLevel.WRITE) {
    if (user.id === row.ownerId && row.status === DataStatus.DRAFT) {
       return AccessLevel.WRITE;
    }
    if (user.id !== row.ownerId && row.status === DataStatus.DRAFT) {
      return AccessLevel.READ;
    }
    if (row.status === DataStatus.APPROVED || row.status === DataStatus.REJECTED) {
      return AccessLevel.READ;
    }
  }

  return permission;
};
