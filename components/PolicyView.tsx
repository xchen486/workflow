
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, UserRole, AccessLevel, Workspace, FieldType, RoleGroup } from '../types';
import { INITIAL_GROUPS } from '../constants';
import { 
  Shield, Users, Lock, Eye, Edit3, 
  AlertCircle, ChevronRight, LayoutGrid, 
  Type, Hash, List, Calendar, Layers,
  Calculator, Cpu, ShoppingCart, Plus, Trash2, Settings, UserPlus, X,
  FileSpreadsheet, Upload, Download, ClipboardList, Filter, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PolicyViewProps {
  users: User[];
  groups: RoleGroup[];
  workspaces: Workspace[];
  onUpdateUserGroup: (userId: string, groupId: string) => void;
  onAddUser: (user: User) => void;
  onUpdateUser: (userId: string, updates: Partial<User>) => void;
  onDeleteUser: (userId: string) => void;
  onBatchUpdateUsers: (newUsers: User[]) => void;
  onUpdatePermission: (workspaceId: string, field: string, groupId: string, level: AccessLevel) => void;
  onUpdateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void; // 新增：用于更新业务属性
  onAddGroup: (group: RoleGroup) => void;
  onDeleteGroup: (groupId: string) => void;
}

const IconMap: Record<string, any> = {
  Calculator, Users, Cpu, ShoppingCart, LayoutGrid: Layers
};

const PolicyView: React.FC<PolicyViewProps> = ({ 
  users, groups, workspaces, 
  onUpdateUserGroup, onAddUser, onUpdateUser, onDeleteUser, onBatchUpdateUsers,
  onUpdatePermission, onUpdateWorkspace, onAddGroup, onDeleteGroup 
}) => {
  const [selectedWsId, setSelectedWsId] = useState(workspaces[0]?.id);
  const [tab, setTab] = useState<'PERMISSIONS' | 'PERSONNEL'>('PERSONNEL');
  const [isRoleSelectorOpen, setIsRoleSelectorOpen] = useState(false); // 控制下拉菜单显示
  const activeWs = workspaces.find(ws => ws.id === selectedWsId) || workspaces[0];
  const userFileInputRef = useRef<HTMLInputElement>(null);

  // 计算当前业务下启用的角色组
  const activeGroups = useMemo(() => {
    if (!activeWs.activeGroupIds) return groups;
    return groups.filter(g => activeWs.activeGroupIds?.includes(g.id));
  }, [activeWs, groups]);

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

  const handleUserImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        
        const mappedUsers: User[] = data.map((d, idx) => ({
          id: String(d.ID || d.id || `U-${Date.now()}-${idx}`),
          name: String(d.姓名 || d.name || '未命名'),
          role: (d.系统角色 || d.role) as UserRole || UserRole.MEMBER,
          groupId: String(d.业务角色组 || d.groupId || groups[0].id),
          managerId: d.上级ID || d.managerId || undefined
        }));
        
        onBatchUpdateUsers(mappedUsers);
      } catch (err) { alert('Excel 解析失败'); }
    };
    reader.readAsBinaryString(file);
  };

  const handleUserPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    
    let rows = text.split(/\r?\n/).filter(r => r.trim());
    const clipboard = rows.map(r => r.split('\t'));
    
    if (confirm('是否确定根据粘贴内容批量更新/替换现有人员列表？')) {
       const newUsers: User[] = clipboard.map((cols, idx) => ({
         id: cols[0] || `U-${Date.now()}-${idx}`,
         name: cols[1] || 'New User',
         role: (cols[2] as UserRole) || UserRole.MEMBER,
         groupId: cols[3] || groups[0].id,
         managerId: cols[4] || undefined
       }));
       onBatchUpdateUsers(newUsers);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
          <div className="bg-indigo-600 p-5 rounded-[2rem] text-white shadow-2xl shadow-indigo-500/30">
            <Shield className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tight">配置控制台</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">ORGANIZATION & ACCESS CONTROL</p>
          </div>
        </div>
        
        <div className="flex gap-4 p-1.5 bg-white/5 rounded-3xl border border-white/5">
          <button onClick={() => setTab('PERSONNEL')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tab === 'PERSONNEL' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>
            <Users className="w-4 h-4"/> 组织架构
          </button>
          <button onClick={() => setTab('PERMISSIONS')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tab === 'PERMISSIONS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>
            <Lock className="w-4 h-4"/> 权限矩阵
          </button>
        </div>
      </div>

      {tab === 'PERMISSIONS' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
          <div className="xl:col-span-1 space-y-4">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-4">选择业务模型</label>
             <div className="space-y-2">
                {workspaces.map(ws => {
                  const Icon = IconMap[ws.icon] || Layers;
                  const isActive = selectedWsId === ws.id;
                  return (
                    <button key={ws.id} onClick={() => setSelectedWsId(ws.id)} className={`w-full flex items-center justify-between p-5 rounded-3xl border transition-all ${isActive ? 'bg-indigo-600/10 border-indigo-500/50 text-white' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'}`}>
                      <div className="flex items-center gap-4">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`} />
                        <span className="text-sm font-black">{ws.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-40"/>
                    </button>
                  );
                })}
             </div>
          </div>
          
          <section className="xl:col-span-3 bg-slate-900 border border-white/5 rounded-[3rem] shadow-2xl overflow-visible relative">
             <div className="px-10 py-8 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <LayoutGrid className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-lg font-black text-white">{activeWs.name} - 字段级权限</h3>
                </div>
                
                {/* 这里的 Dropdown 菜单 */}
                <div className="relative">
                  <button 
                    onClick={() => setIsRoleSelectorOpen(!isRoleSelectorOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase border border-white/10 transition-all"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    配置参与角色 ({activeGroups.length})
                  </button>
                  
                  {isRoleSelectorOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsRoleSelectorOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden p-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">勾选参与此业务的角色</div>
                        {groups.map(g => {
                          const isSelected = activeWs.activeGroupIds ? activeWs.activeGroupIds.includes(g.id) : true;
                          return (
                            <button 
                              key={g.id}
                              onClick={() => handleToggleGroup(g.id)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${g.color}`} />
                                <span className="text-xs font-bold">{g.name}</span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-black/20">
                    <tr>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase border-r border-white/5 w-64">数据字段 (Field)</th>
                      {activeGroups.map(g => (
                        <th key={g.id} className="px-6 py-6 text-center border-r border-white/5">
                           <div className="flex flex-col items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${g.color}`} />
                              <span className="text-[10px] font-black text-white uppercase">{g.name}</span>
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
        </div>
      ) : (
        /* Personnel Grid Tab (Same as before) */
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-white">组织与人员架构</h3>
                <p className="text-sm text-slate-500 mt-1">支持 Excel 粘贴与批量导入。Manager ID 决定数据层级可见性。</p>
              </div>
              <div className="flex items-center gap-4">
                 <input type="file" ref={userFileInputRef} onChange={handleUserImport} className="hidden" accept=".xlsx,.xls"/>
                 <button onClick={() => userFileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-xs font-black border border-white/10 transition-all">
                    <Upload className="w-4 h-4"/> 导入 Excel
                 </button>
                 <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-2xl transition-all">
                    <Plus className="w-4 h-4"/> 新增成员
                 </button>
              </div>
           </div>

           <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden" onPaste={handleUserPaste}>
              <div className="px-10 py-6 bg-white/5 border-b border-white/10 flex justify-between items-center">
                 <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <ClipboardList className="w-4 h-4 text-indigo-400"/> 系统级人员配置表
                 </div>
              </div>
              <table className="w-full text-left table-fixed">
                 <thead className="bg-black/20">
                    <tr>
                       <th className="w-24 px-8 py-4 text-[10px] font-black text-slate-500 uppercase">UID</th>
                       <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase">姓名</th>
                       <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase">系统角色</th>
                       <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase">业务角色组</th>
                       <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase">汇报对象</th>
                       <th className="w-20 px-8 py-4 text-[10px] font-black text-slate-500 uppercase text-center">操作</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                       <tr key={u.id} className="hover:bg-white/[0.02] group">
                          <td className="px-8 py-4 text-xs font-mono text-slate-500">{u.id}</td>
                          <td className="px-8 py-4">
                             <input value={u.name} onChange={e => onUpdateUser(u.id, {name: e.target.value})} className="bg-transparent text-xs font-black text-white border-b border-transparent focus:border-indigo-500 outline-none w-full"/>
                          </td>
                          <td className="px-8 py-4">
                             <select value={u.role} onChange={e => onUpdateUser(u.id, {role: e.target.value as UserRole})} className="bg-slate-800 border-none rounded-lg text-xs font-bold text-slate-300 px-3 py-1.5 outline-none w-full">
                                {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                             </select>
                          </td>
                          <td className="px-8 py-4">
                             <select value={u.groupId} onChange={e => onUpdateUserGroup(u.id, e.target.value)} className="bg-slate-800 border-none rounded-lg text-xs font-bold text-slate-300 px-3 py-1.5 outline-none w-full">
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                             </select>
                          </td>
                          <td className="px-8 py-4">
                             <select value={u.managerId || ''} onChange={e => onUpdateUser(u.id, {managerId: e.target.value || undefined})} className="bg-slate-800 border-none rounded-lg text-xs font-bold text-slate-300 px-3 py-1.5 outline-none w-full">
                                <option value="">- 无 -</option>
                                {users.filter(other => other.id !== u.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                             </select>
                          </td>
                          <td className="px-8 py-4 text-center">
                             <button onClick={() => onDeleteUser(u.id)} className="text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default PolicyView;
