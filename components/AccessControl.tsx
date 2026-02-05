
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
 * 行级权限控制：决定用户是否有权看到这一行数据
 */
export const canViewRow = (user: User, row: TableRow, allUsers: User[]): boolean => {
  // 1. 系统管理员：全局可见
  if (user.role === UserRole.ADMIN) return true;
  
  // 2. 本人数据：始终可见
  if (user.id === row.ownerId) return true;
  
  // 3. 管理者逻辑：可见下属的所有数据
  if (user.role === UserRole.LEADER) {
    const subordinateIds = getAllSubordinates(user.id, allUsers);
    if (subordinateIds.includes(row.ownerId)) return true;
  }
  
  // 4. 其他情况：如果该业务空间没有严格行隔离，默认所有人可见（但在 UI 层可以通过状态过滤）
  // 为了安全，默认只看自己和下属的。如果需要“全员可见”业务，可根据 Workspace 类型调整。
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
  if (user.role === UserRole.ADMIN) return AccessLevel.WRITE;
  if (field === 'status') return AccessLevel.WRITE;

  const metaFields = ['id', 'updatedAt', 'ownerId', 'version'];
  if (metaFields.includes(field)) return AccessLevel.READ;

  const column = workspace.columns.find(c => c.field === field);
  if (!column) return AccessLevel.NONE;

  const userGroupId = user.groupId;
  const configuredPermission = column.groupPermissions?.[userGroupId];

  let permission = configuredPermission || AccessLevel.NONE;

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
