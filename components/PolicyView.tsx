
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, UserRole, AccessLevel, Workspace, FieldType, RoleGroup } from '../types';
import { INITIAL_GROUPS } from '../constants';
import { 
  Shield, Users, Lock, Eye, Edit3, 
  AlertCircle, ChevronRight, LayoutGrid, 
  Type, Hash, List, Calendar, Layers,
  Calculator, Cpu, ShoppingCart, Plus, Trash2, Settings, UserPlus, X,
  FileSpreadsheet, Upload, Download, ClipboardList, Filter, Check, Briefcase, Crown, UserCog
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PolicyViewProps {
  currentUser: User; // Need to know who is viewing to allow admin editing
  users: User[];
  groups: RoleGroup[];
  workspaces: Workspace[];
  onUpdateUserGroup: (userId: string, groupId: string) => void;
  onAddUser: (user: User) => void;
  onUpdateUser: (userId: string, updates: Partial<User>) => void;
  onDeleteUser: (userId: string) => void;
  onBatchUpdateUsers: (newUsers: User[]) => void;
  onUpdatePermission: (workspaceId: string, field: string, groupId: string, level: AccessLevel) => void;
  onUpdateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  onAddGroup: (group: RoleGroup) => void;
  onDeleteGroup: (groupId: string) => void;
}

const IconMap: Record<string, any> = {
  Calculator, Users, Cpu, ShoppingCart, LayoutGrid: Layers
};

const PolicyView: React.FC<PolicyViewProps> = ({ 
  currentUser, users, groups, workspaces, 
  onUpdateUserGroup, onAddUser, onUpdateUser, onDeleteUser, onBatchUpdateUsers,
  onUpdatePermission, onUpdateWorkspace, onAddGroup, onDeleteGroup 
}) => {
  const [selectedWsId, setSelectedWsId] = useState(workspaces[0]?.id);
  const [tab, setTab] = useState<'PERMISSIONS' | 'PERSONNEL'>('PERSONNEL');
  const [isRoleSelectorOpen, setIsRoleSelectorOpen] = useState(false);
  const [isAdminSelectorOpen, setIsAdminSelectorOpen] = useState(false); // Controls the admin dropdown

  const activeWs = workspaces.find(ws => ws.id === selectedWsId) || workspaces[0];
  const userFileInputRef = useRef<HTMLInputElement>(null);

  // 计算当前业务下启用的角色组
  const activeGroups = useMemo(() => {
    if (!activeWs.activeGroupIds) return groups;
    return groups.filter(g => activeWs.activeGroupIds?.includes(g.id));
  }, [activeWs, groups]);

  // 过滤当前业务下的用户
  const workspaceUsers = useMemo(() => {
    const activeGroupIds = activeGroups.map(g => g.id);
    return users.filter(u => activeGroupIds.includes(u.groupId));
  }, [users, activeGroups]);

  // 获取当前工作区的管理员用户对象
  const workspaceAdmins = useMemo(() => {
    return users.filter(u => activeWs.adminIds?.includes(u.id));
  }, [users, activeWs.adminIds]);

  const handleToggleGroup = (groupId: string) => {
    const currentIds = activeWs.activeGroupIds || groups.map(g => g.id);
    let newIds;
    if (currentIds.includes(groupId)) {
      newIds = currentIds.filter(id => id !== groupId);
    } else {
      newIds = [...currentIds, groupId];
    }
    onUpdateWorkspace(activeWs.id, { activeGroupIds: newIds });
  };

  const handleToggleAdmin = (userId: string) => {
    const currentAdmins = activeWs.adminIds || [];
    let newAdmins;
    if (currentAdmins.includes(userId)) {
      newAdmins = currentAdmins.filter(id => id !== userId);
    } else {
      newAdmins = [...currentAdmins, userId];
    }
    onUpdateWorkspace(activeWs.id, { adminIds: newAdmins });
  };

  const handleUserImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        const defaultGroupId = activeGroups[0]?.id || groups[0].id;

        const mappedUsers: User[] = data.map((d, idx) => ({
          id: String(d.ID || d.id || `U-${Date.now()}-${idx}`),
          name: String(d.姓名 || d.name || '未命名'),
          role: (d.系统角色 || d.role) as UserRole || UserRole.MEMBER,
          groupId: String(d.业务角色组 || d.groupId || defaultGroupId),
          managerId: d.上级ID || d.managerId || undefined
        }));
        
        if (confirm(`即将导入 ${mappedUsers.length} 名用户。注意：这将更新系统用户列表。`)) {
            const existingIds = new Set(users.map(u => u.id));
            const newUsersList = [...users];
            mappedUsers.forEach(nu => {
                const idx = newUsersList.findIndex(u => u.id === nu.id);
                if (idx >= 0) newUsersList[idx] = nu;
                else newUsersList.push(nu);
            });
            onBatchUpdateUsers(newUsersList);
        }
      } catch (err) { alert('Excel 解析失败'); }
    };
    reader.readAsBinaryString(file);
  };

  const handleUserPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    
    let rows = text.split(/\r?\n/).filter(r => r.trim());
    const clipboard = rows.map(r => r.split('\t'));
    const defaultGroupId = activeGroups[0]?.id || groups[0].id;

    if (confirm('检测到粘贴操作。是否将其添加/更新到当前人员列表？')) {
       const newUsersToAdd: User[] = clipboard.map((cols, idx) => ({
         id: cols[0] || `U-${Date.now()}-${idx}`,
         name: cols[1] || 'New User',
         role: (cols[2] as UserRole) || UserRole.MEMBER,
         groupId: cols[3] || defaultGroupId, 
         managerId: cols[4] || undefined
       }));
       
       const newUsersList = [...users];
       newUsersToAdd.forEach(nu => {
            const idx = newUsersList.findIndex(u => u.id === nu.id);
            if (idx >= 0) newUsersList[idx] = nu;
            else newUsersList.push(nu);
       });
       onBatchUpdateUsers(newUsersList);
    }
  };

  const cyclePermission = (field: string, groupId: string) => {
    const col = activeWs.columns.find(c => c.field === field);
    const current = col?.groupPermissions?.[groupId] || AccessLevel.NONE;
    const next = current === AccessLevel.NONE ? AccessLevel.READ : current === AccessLevel.READ ? AccessLevel.WRITE : AccessLevel.NONE;
    onUpdatePermission(activeWs.id, field, groupId, next);
  };

  return (
    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header Area */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
          <div className="bg-indigo-600 p-5 rounded-[2rem] text-white shadow-2xl shadow-indigo-500/30">
            <Shield className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tight">配置控制台</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">ORGANIZATION & ACCESS CONTROL</p>
          </div>
        </div>

        {/* Workspace Admin Management Widget */}
        <div className="flex items-center gap-6 bg-slate-900 border border-white/10 p-2 pr-6 rounded-[2rem]">
            <div className="bg-white/5 p-3 rounded-2xl">
                <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">工作区管理员 (Workspace Admins)</span>
                <div className="flex items-center gap-2 mt-1 relative">
                    {workspaceAdmins.length === 0 ? (
                        <span className="text-xs font-bold text-slate-600 italic">暂无指定管理员 (仅系统Admin可管)</span>
                    ) : (
                        <div className="flex -space-x-2">
                            {workspaceAdmins.map(admin => (
                                <div key={admin.id} className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold text-white relative group cursor-help" title={`${admin.name} (${admin.id})`}>
                                    {admin.name[0]}
                                </div>
                            ))}
                            <span className="ml-4 text-xs font-bold text-white">{workspaceAdmins.map(a => a.name).join(', ')}</span>
                        </div>
                    )}
                    
                    {/* Only System Admin can modify workspace admins */}
                    {currentUser.role === UserRole.ADMIN && (
                        <div className="relative ml-2">
                             <button onClick={() => setIsAdminSelectorOpen(!isAdminSelectorOpen)} className="p-1 hover:bg-white/10 rounded-full text-indigo-400 transition-colors" title="管理工作区管理员">
                                <Settings className="w-4 h-4" />
                             </button>
                             {isAdminSelectorOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setIsAdminSelectorOpen(false)}></div>
                                  <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden p-2 animate-in fade-in zoom-in-95 duration-200">
                                      <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-white/5 mb-1">
                                          勾选用户作为此业务管理员
                                      </div>
                                      <div className="max-h-60 overflow-y-auto">
                                          {users.map(u => {
                                              const isAdm = activeWs.adminIds?.includes(u.id);
                                              return (
                                                  <button key={u.id} onClick={() => handleToggleAdmin(u.id)} className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${isAdm ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-white/5'}`}>
                                                      <div className="flex items-center gap-3">
                                                          <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[9px] font-bold text-white">{u.name[0]}</div>
                                                          <div>
                                                              <div className="text-xs font-bold">{u.name}</div>
                                                              <div className="text-[9px] opacity-60">{u.role}</div>
                                                          </div>
                                                      </div>
                                                      {isAdm && <Check className="w-3.5 h-3.5" />}
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  </div>
                                </>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
        
        {/* Left Sidebar: Workspace Selector */}
        <div className="xl:col-span-1 space-y-6">
             <div className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">业务模型 (Workspace)</div>
             <div className="space-y-2">
                {workspaces.map(ws => {
                  const Icon = IconMap[ws.icon] || Layers;
                  const isActive = selectedWsId === ws.id;
                  const isAdminOfWs = ws.adminIds?.includes(currentUser.id);

                  return (
                    <button key={ws.id} onClick={() => setSelectedWsId(ws.id)} className={`w-full flex items-center justify-between p-5 rounded-3xl border transition-all ${isActive ? 'bg-indigo-600/10 border-indigo-500/50 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'}`}>
                      <div className="flex items-center gap-4">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`} />
                        <div className="text-left">
                            <span className="text-sm font-black block">{ws.name}</span>
                            {isAdminOfWs && <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1"><Crown className="w-3 h-3"/> Admin</span>}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-all ${isActive ? 'text-indigo-400 opacity-100' : 'opacity-40'}`}/>
                    </button>
                  );
                })}
             </div>
             
             {/* Global Stats */}
             <div className="mt-8 p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                <div className="flex items-center gap-3 text-slate-400">
                    <Users className="w-4 h-4"/>
                    <span className="text-xs font-bold">总人数: {users.length}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                    <Briefcase className="w-4 h-4"/>
                    <span className="text-xs font-bold">当前业务人数: {workspaceUsers.length}</span>
                </div>
             </div>
        </div>

        {/* Right Content Area */}
        <div className="xl:col-span-3 space-y-6">
            {/* Tabs */}
            <div className="flex gap-4 p-1.5 bg-slate-900 rounded-3xl border border-white/5 w-fit">
              <button onClick={() => setTab('PERSONNEL')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tab === 'PERSONNEL' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>
                <Users className="w-3.5 h-3.5"/> 组织架构
              </button>
              <button onClick={() => setTab('PERMISSIONS')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tab === 'PERMISSIONS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>
                <Lock className="w-3.5 h-3.5"/> 权限矩阵
              </button>
            </div>

            {/* Tab Content */}
            {tab === 'PERMISSIONS' ? (
                <section className="bg-slate-900 border border-white/5 rounded-[3rem] shadow-2xl overflow-visible relative animate-in fade-in zoom-in-95 duration-300">
                   <div className="px-10 py-8 bg-white/5 border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <LayoutGrid className="w-6 h-6 text-indigo-400" />
                        <h3 className="text-lg font-black text-white">{activeWs.name} - 字段级权限</h3>
                      </div>
                      
                      <div className="relative">
                        <button onClick={() => setIsRoleSelectorOpen(!isRoleSelectorOpen)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase border border-white/10 transition-all shadow-lg hover:shadow-indigo-500/10">
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          可见性与准入控制 ({activeGroups.length})
                        </button>
                        
                        {isRoleSelectorOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsRoleSelectorOpen(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden p-2 animate-in fade-in zoom-in-95 duration-200">
                              <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">勾选以允许该角色组访问此业务</div>
                              {groups.map(g => {
                                const isSelected = activeWs.activeGroupIds ? activeWs.activeGroupIds.includes(g.id) : true;
                                return (
                                  <button key={g.id} onClick={() => handleToggleGroup(g.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-white/5'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${g.color}`} />
                                      <span className="text-xs font-bold">{g.name}</span>
                                    </div>
                                    {isSelected ? <Eye className="w-3.5 h-3.5" /> : <span className="text-[10px] opacity-50">Hidden</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                   </div>
                   
                   {/* Admin Note */}
                   <div className="px-10 py-4 bg-amber-500/5 border-b border-amber-500/10 flex items-center gap-3">
                        <Crown className="w-4 h-4 text-amber-500" />
                        <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wide">
                            提示: 工作区管理员 ({workspaceAdmins.map(a => a.name).join(', ') || 'None'}) 默认拥有所有字段的 WRITE 权限，无需在此矩阵配置。
                        </p>
                   </div>

                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-black/20">
                          <tr>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase border-r border-white/5 w-64">数据字段 (Field)</th>
                            {activeGroups.map(g => (
                              <th key={g.id} className="px-6 py-6 text-center border-r border-white/5 relative">
                                 <div className="flex flex-col items-center gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${g.color}`} />
                                        <span className="text-[10px] font-black text-white uppercase">{g.name}</span>
                                    </div>
                                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase rounded-md border border-emerald-500/20">Visible</span>
                                 </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {activeWs.columns.map(col => (
                            <tr key={col.field} className="hover:bg-white/[0.01]">
                              <td className="px-10 py-6 border-r border-white/5 font-bold text-slate-300 text-sm">{col.label}</td>
                              {activeGroups.map(g => {
                                 const level = col.groupPermissions?.[g.id] || AccessLevel.NONE;
                                 return (
                                   <td key={g.id} className="px-4 py-4 border-r border-white/5 text-center cursor-pointer" onClick={() => cyclePermission(col.field, g.id)}>
                                      <div className={`inline-block px-4 py-2 rounded-xl text-[9px] font-black uppercase border ${level === AccessLevel.WRITE ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : level === AccessLevel.READ ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-600 border-transparent'}`}>
                                        {level}
                                      </div>
                                   </td>
                                 );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </section>
            ) : (
                /* Personnel Grid Tab - Context Aware */
                <div className="space-y-6 animate-in fade-in duration-500">
                   <div className="flex justify-between items-center bg-slate-900 border border-white/5 p-6 rounded-[2rem]">
                      <div>
                        <h3 className="text-xl font-black text-white flex items-center gap-3">
                           {activeWs.name} <span className="text-slate-600">/</span> 人员配置
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-bold">
                           当前仅显示属于 <span className="text-indigo-400">{activeGroups.map(g => g.name).join(', ')}</span> 的成员
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                         <input type="file" ref={userFileInputRef} onChange={handleUserImport} className="hidden" accept=".xlsx,.xls"/>
                         <button onClick={() => userFileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-black border border-white/10 transition-all">
                            <Upload className="w-3.5 h-3.5"/> 导入 Excel
                         </button>
                         <button 
                            onClick={() => {
                               const newId = `U-${Date.now()}`;
                               onAddUser({ 
                                   id: newId, 
                                   name: 'New Member', 
                                   role: UserRole.MEMBER, 
                                   groupId: activeGroups[0]?.id || groups[0].id 
                               });
                            }} 
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black shadow-lg transition-all"
                        >
                            <Plus className="w-3.5 h-3.5"/> 新增成员
                         </button>
                      </div>
                   </div>

                   <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden" onPaste={handleUserPaste}>
                      <div className="px-8 py-5 bg-white/5 border-b border-white/10 flex justify-between items-center">
                         <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <ClipboardList className="w-4 h-4 text-indigo-400"/> 当前业务人员列表 ({workspaceUsers.length})
                         </div>
                      </div>
                      {workspaceUsers.length === 0 ? (
                          <div className="p-10 text-center text-slate-500 text-sm font-bold">
                              当前业务角色组下暂无人员，请点击右上角新增或导入。
                          </div>
                      ) : (
                          <table className="w-full text-left table-fixed">
                             <thead className="bg-black/20">
                                <tr>
                                   <th className="w-24 px-6 py-4 text-[10px] font-black text-slate-500 uppercase">UID</th>
                                   <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">姓名</th>
                                   <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">系统角色</th>
                                   <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">业务角色组</th>
                                   <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">汇报对象</th>
                                   <th className="w-16 px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-center">操作</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-white/5">
                                {workspaceUsers.map(u => (
                                   <tr key={u.id} className="hover:bg-white/[0.02] group transition-colors">
                                      <td className="px-6 py-4 text-[10px] font-mono text-slate-500">{u.id}</td>
                                      <td className="px-6 py-4">
                                         <input value={u.name} onChange={e => onUpdateUser(u.id, {name: e.target.value})} className="bg-transparent text-xs font-black text-white border-b border-transparent focus:border-indigo-500 outline-none w-full placeholder-slate-600"/>
                                      </td>
                                      <td className="px-6 py-4">
                                         <select value={u.role} onChange={e => onUpdateUser(u.id, {role: e.target.value as UserRole})} className="bg-slate-800 border-none rounded-lg text-[10px] font-bold text-slate-300 px-3 py-1.5 outline-none w-full">
                                            {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                                         </select>
                                      </td>
                                      <td className="px-6 py-4">
                                         <select value={u.groupId} onChange={e => onUpdateUserGroup(u.id, e.target.value)} className="bg-slate-800 border-none rounded-lg text-[10px] font-bold text-slate-300 px-3 py-1.5 outline-none w-full">
                                            {activeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                         </select>
                                      </td>
                                      <td className="px-6 py-4">
                                         <select value={u.managerId || ''} onChange={e => onUpdateUser(u.id, {managerId: e.target.value || undefined})} className="bg-slate-800 border-none rounded-lg text-[10px] font-bold text-slate-300 px-3 py-1.5 outline-none w-full">
                                            <option value="">- Top Level -</option>
                                            {users.filter(other => other.id !== u.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                         </select>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                         <button onClick={() => onDeleteUser(u.id)} className="text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
                                      </td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                      )}
                   </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PolicyView;
