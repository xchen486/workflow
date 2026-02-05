
export enum UserRole {
  MEMBER = 'MEMBER', // 仅用于系统级菜单控制
  LEADER = 'LEADER',
  ADMIN = 'ADMIN'    // 超级管理员，无视规则
}

export enum DataStatus {
  DRAFT = 'Draft',
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected'
}

export enum AccessLevel {
  READ = 'READ',
  WRITE = 'WRITE',
  NONE = 'NONE'
}

export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  DATE = 'date'
}

// 角色组定义
export interface RoleGroup {
  id: string;
  name: string;
  color: string; // 用于UI展示
  description?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole; // 系统角色 (Admin vs Standard)
  groupId: string; // 关联的业务角色组ID
  managerId?: string;
}

export interface TableRow {
  id: string;
  workspaceId: string;
  status: DataStatus;
  ownerId: string;
  version: number;
  updatedAt: string;
  [key: string]: any;
}

export interface ColumnPermission {
  field: string;
  label: string;
  type: FieldType;
  options?: string[];
  isSensitive?: boolean;
  // 组权限映射 { "GROUP_ID": "WRITE" }
  groupPermissions?: Record<string, AccessLevel>; 
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  columns: ColumnPermission[];
  activeGroupIds?: string[]; // 核心控制：决定该业务对哪些角色组可见（Sidebar Visibility）以及参与审批流
  adminIds?: string[]; // 新增：工作区管理员ID列表，拥有该工作区的最高权限
}

export interface AuditLog {
  id: string;
  rowId: string;
  workspaceId: string;
  operatorName: string;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
}
