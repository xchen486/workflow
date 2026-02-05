
import { UserRole, User, TableRow, DataStatus, Workspace, FieldType, RoleGroup, AccessLevel } from './types';

// 预定义角色组
export const INITIAL_GROUPS: RoleGroup[] = [
  { id: 'G-GENERAL', name: '普通员工', color: 'bg-blue-500', description: '基础业务发起人' },
  { id: 'G-MANAGER', name: '部门经理', color: 'bg-emerald-500', description: '业务审批人员' },
  { id: 'G-AUDIT', name: '财务/HR 专员', color: 'bg-amber-500', description: '职能部门审核' },
  { id: 'G-VP', name: '副总裁', color: 'bg-purple-500', description: '高阶决策层' }
];

export const MOCK_USERS: User[] = [
  { id: '1', name: '系统管理员', role: UserRole.ADMIN, groupId: 'G-AUDIT' }, // God Mode
  { id: '2', name: '张伟 (华东经理)', role: UserRole.LEADER, groupId: 'G-MANAGER' },
  { id: '3', name: '李芳 (销售)', role: UserRole.MEMBER, groupId: 'G-GENERAL', managerId: '2' },
  { id: '4', name: '王超 (销售)', role: UserRole.MEMBER, groupId: 'G-GENERAL', managerId: '2' },
  { id: '5', name: '陈静 (技术主管)', role: UserRole.LEADER, groupId: 'G-MANAGER', managerId: '1' },
  { id: '6', name: 'Sarah (财务)', role: UserRole.MEMBER, groupId: 'G-AUDIT' },
  { id: '7', name: 'Mike (研发)', role: UserRole.MEMBER, groupId: 'G-GENERAL', managerId: '5' },
  { id: '8', name: '刘总 (VP)', role: UserRole.LEADER, groupId: 'G-VP' }
];

export const WORKSPACES: Workspace[] = [
  {
    id: 'WS-FINANCE',
    name: '财务报销审批',
    icon: 'Calculator',
    columns: [
      { 
        field: 'title', label: '报销事由', type: FieldType.TEXT,
        groupPermissions: { 'G-GENERAL': AccessLevel.WRITE, 'G-MANAGER': AccessLevel.READ, 'G-AUDIT': AccessLevel.READ, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'category', label: '费用类别', type: FieldType.SELECT, options: ['差旅', '办公', '餐饮', '福利', '硬件采购'],
        groupPermissions: { 'G-GENERAL': AccessLevel.WRITE, 'G-MANAGER': AccessLevel.READ, 'G-AUDIT': AccessLevel.WRITE, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'date', label: '发生日期', type: FieldType.DATE,
        groupPermissions: { 'G-GENERAL': AccessLevel.WRITE, 'G-MANAGER': AccessLevel.READ, 'G-AUDIT': AccessLevel.READ, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'amount', label: '报销金额', type: FieldType.NUMBER, isSensitive: true,
        groupPermissions: { 'G-GENERAL': AccessLevel.WRITE, 'G-MANAGER': AccessLevel.READ, 'G-AUDIT': AccessLevel.WRITE, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'region', label: '所属地区', type: FieldType.SELECT, options: ['华东', '华北', '华南', '海外'],
        groupPermissions: { 'G-GENERAL': AccessLevel.WRITE, 'G-MANAGER': AccessLevel.READ, 'G-AUDIT': AccessLevel.READ, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'approvalNote', label: '审核意见', type: FieldType.TEXT,
        groupPermissions: { 'G-GENERAL': AccessLevel.READ, 'G-MANAGER': AccessLevel.WRITE, 'G-AUDIT': AccessLevel.WRITE, 'G-VP': AccessLevel.WRITE }
      }
    ]
  },
  {
    id: 'WS-HR',
    name: '调薪申请',
    icon: 'Users',
    columns: [
      { 
        field: 'employeeName', label: '员工姓名', type: FieldType.TEXT,
        groupPermissions: { 'G-GENERAL': AccessLevel.READ, 'G-MANAGER': AccessLevel.WRITE, 'G-AUDIT': AccessLevel.READ, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'position', label: '职级/岗位', type: FieldType.SELECT, options: ['P5', 'P6', 'P7', 'P8', 'M1', 'M2'],
        groupPermissions: { 'G-GENERAL': AccessLevel.READ, 'G-MANAGER': AccessLevel.WRITE, 'G-AUDIT': AccessLevel.READ, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'effectiveDate', label: '生效日期', type: FieldType.DATE,
        groupPermissions: { 'G-GENERAL': AccessLevel.READ, 'G-MANAGER': AccessLevel.WRITE, 'G-AUDIT': AccessLevel.WRITE, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'currentSalary', label: '当前薪资', type: FieldType.NUMBER, isSensitive: true,
        groupPermissions: { 'G-GENERAL': AccessLevel.READ, 'G-MANAGER': AccessLevel.READ, 'G-AUDIT': AccessLevel.READ, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'targetSalary', label: '期望薪资', type: FieldType.NUMBER, isSensitive: true,
        groupPermissions: { 'G-GENERAL': AccessLevel.READ, 'G-MANAGER': AccessLevel.WRITE, 'G-AUDIT': AccessLevel.READ, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'reason', label: '调薪原因', type: FieldType.TEXT,
        groupPermissions: { 'G-GENERAL': AccessLevel.READ, 'G-MANAGER': AccessLevel.WRITE, 'G-AUDIT': AccessLevel.READ, 'G-VP': AccessLevel.READ }
      },
      { 
        field: 'approvalNote', label: 'HRBP意见', type: FieldType.TEXT,
        groupPermissions: { 'G-GENERAL': AccessLevel.READ, 'G-MANAGER': AccessLevel.READ, 'G-AUDIT': AccessLevel.WRITE, 'G-VP': AccessLevel.WRITE }
      }
    ]
  }
];

// Helper to generate random data
const generateMockData = (): TableRow[] => {
  const data: TableRow[] = [];
  const statuses = [DataStatus.DRAFT, DataStatus.PENDING, DataStatus.APPROVED, DataStatus.REJECTED];
  const categories = ['差旅', '办公', '餐饮', '福利', '硬件采购', '软件服务', '营销推广'];
  const regions = ['华东', '华北', '华南', '海外', '西南'];
  const titles = ['客户拜访', '季度会议', '服务器续费', '团队建设', '新员工入职', '广告投放', '办公用品采购', '出差报销'];
  
  // Base Finance Data
  for (let i = 0; i < 50; i++) {
    const isApproved = Math.random() > 0.7;
    data.push({
      id: `R-AUTO-10${i}`,
      workspaceId: 'WS-FINANCE',
      title: `${regions[Math.floor(Math.random() * regions.length)]}区 - ${titles[Math.floor(Math.random() * titles.length)]} ${i+1}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      date: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
      amount: Math.floor(Math.random() * 50000) + 100,
      region: regions[Math.floor(Math.random() * regions.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      ownerId: String(Math.floor(Math.random() * 6) + 2), // Random user ID 2-7
      version: 1,
      updatedAt: new Date().toISOString()
    });
  }

  // Base HR Data
  const employees = ['Alex', 'Betty', 'Charlie', 'David', 'Eva', 'Frank', 'Grace'];
  for (let i = 0; i < 20; i++) {
    const current = Math.floor(Math.random() * 20000) + 10000;
    data.push({
      id: `R-AUTO-20${i}`,
      workspaceId: 'WS-HR',
      employeeName: employees[Math.floor(Math.random() * employees.length)],
      position: `P${Math.floor(Math.random() * 4) + 5}`,
      effectiveDate: new Date(Date.now() + Math.random() * 5000000000).toISOString().split('T')[0],
      currentSalary: current,
      targetSalary: current + Math.floor(Math.random() * 5000),
      reason: '年度绩效优秀，申请调薪',
      status: statuses[Math.floor(Math.random() * statuses.length)],
      ownerId: String(Math.floor(Math.random() * 6) + 2),
      version: 1,
      updatedAt: new Date().toISOString()
    });
  }

  return data;
};

export const INITIAL_DATA: TableRow[] = [
  // 保留一些特定的初始数据用于展示特定Case
  {
    id: 'R-1001',
    workspaceId: 'WS-FINANCE',
    title: 'Q1 市场推广差旅费',
    category: '差旅',
    date: '2024-03-15',
    amount: 15200,
    region: '华东',
    status: DataStatus.PENDING,
    ownerId: '3', 
    version: 1,
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  ...generateMockData()
];
