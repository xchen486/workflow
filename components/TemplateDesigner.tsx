
import React, { useState, useEffect, useRef } from 'react';
import { Workspace, FieldType, ColumnPermission, TableRow, DataStatus, AccessLevel, RoleGroup, User } from '../types';
import { INITIAL_GROUPS } from '../constants';
import { Plus, Trash2, Layout, Type, Hash, List, Settings2, Save, X, Calendar, UploadCloud, FileSpreadsheet, Sparkles, CheckCircle2, UserCog, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

interface TemplateDesignerProps {
  initialData?: Workspace | null;
  onSave: (ws: Workspace, importedData?: TableRow[]) => void;
  onCancel: () => void;
  currentUserId: string;
  users: User[]; // 需要传入所有用户列表以供选择
}

const TemplateDesigner: React.FC<TemplateDesignerProps> = ({ initialData, onSave, onCancel, currentUserId, users }) => {
  const [name, setName] = useState('');
  const [activeGroupIds, setActiveGroupIds] = useState<string[]>(INITIAL_GROUPS.map(g => g.id));
  const [adminIds, setAdminIds] = useState<string[]>([]); // 工作区管理员
  const [columns, setColumns] = useState<ColumnPermission[]>([
    { field: 'title', label: '主要事由', type: FieldType.TEXT, groupPermissions: { 'G-GENERAL': AccessLevel.WRITE } },
  ]);
  const [tempImportedRows, setTempImportedRows] = useState<any[]>([]);
  const [isUserSelectorOpen, setIsUserSelectorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setColumns(initialData.columns);
      setActiveGroupIds(initialData.activeGroupIds || INITIAL_GROUPS.map(g => g.id));
      setAdminIds(initialData.adminIds || []);
    } else {
        // 新建时，默认当前创建者为管理员（如果不是全局admin）
        setAdminIds([currentUserId]);
    }
  }, [initialData, currentUserId]);

  const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'field_' + Math.random().toString(36).substr(2, 4);

  const toggleGroup = (groupId: string) => {
    setActiveGroupIds(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const toggleAdmin = (userId: string) => {
      setAdminIds(prev => 
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const jsonData = XLSX.utils.sheet_to_json(ws);

        if (jsonData.length === 0) return alert('Excel 文件为空');

        const firstRow = jsonData[0] as any;
        const newCols: ColumnPermission[] = Object.keys(firstRow).map(key => {
          const val = firstRow[key];
          let type = FieldType.TEXT;
          if (typeof val === 'number') type = FieldType.NUMBER;
          if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) type = FieldType.DATE;

          return {
            field: slugify(key),
            label: key,
            type,
            groupPermissions: { 'G-GENERAL': AccessLevel.WRITE }
          };
        });

        setColumns(newCols);
        setTempImportedRows(jsonData);
        if (!name) setName(file.name.replace(/\.[^/.]+$/, ""));
      } catch (err) {
        alert('解析失败，请检查文件格式');
      }
    };
    reader.readAsBinaryString(file);
  };

  const addColumn = () => {
    const id = Math.random().toString(36).substr(2, 5);
    setColumns([...columns, { field: `field_${id}`, label: '新字段', type: FieldType.TEXT }]);
  };

  const removeColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, updates: Partial<ColumnPermission>) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], ...updates };
    setColumns(newCols);
  };

  const handleSave = () => {
    if (!name) return alert('请输入业务名称');
    if (activeGroupIds.length === 0) return alert('请至少选择一个参与业务的角色组');
    
    const wsId = initialData?.id || `WS-${Date.now()}`;
    const newWs: Workspace = {
      id: wsId, 
      name,
      icon: initialData?.icon || 'Layout',
      columns: columns,
      activeGroupIds: activeGroupIds,
      adminIds: adminIds
    };

    let finalRows: TableRow[] | undefined = undefined;
    if (tempImportedRows.length > 0) {
      finalRows = tempImportedRows.map((row, idx) => {
        const newRow: any = {
          id: `R-IMP-${Date.now()}-${idx}`,
          workspaceId: wsId,
          status: DataStatus.APPROVED,
          ownerId: currentUserId,
          version: 1,
          updatedAt: new Date().toISOString()
        };
        columns.forEach(col => {
          newRow[col.field] = row[col.label];
        });
        return newRow as TableRow;
      });
    }

    onSave(newWs, finalRows);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-10 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 w-full max-w-6xl rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
        <div className="p-10 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="bg-indigo-600 p-4 rounded-3xl text-white">
              <Settings2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">业务架构师</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                Schema Design & Role Filtering
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-4 hover:bg-white/5 rounded-full transition-colors text-slate-500"><X className="w-8 h-8"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-10">
              <section className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">基本信息</label>
                <div className="grid grid-cols-2 gap-6">
                    <input 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="业务空间名称"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    
                    {/* Admin Selector */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsUserSelectorOpen(!isUserSelectorOpen)}
                            className="w-full h-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-left flex items-center justify-between hover:bg-white/10 transition-all"
                        >
                            <span className="text-sm font-bold text-slate-300">
                                {adminIds.length === 0 ? '指定工作区管理员' : `管理员: ${adminIds.length} 人`}
                            </span>
                            <UserCog className="w-5 h-5 text-indigo-400" />
                        </button>
                        {isUserSelectorOpen && (
                            <>
                             <div className="fixed inset-0 z-10" onClick={() => setIsUserSelectorOpen(false)}/>
                             <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl p-2 z-20 max-h-60 overflow-y-auto shadow-2xl">
                                <div className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase">选择能够管理此业务的用户</div>
                                {users.map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => toggleAdmin(u.id)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-white">
                                                {u.name[0]}
                                            </div>
                                            <div className="text-left">
                                                <div className={`text-xs font-bold ${adminIds.includes(u.id) ? 'text-indigo-400' : 'text-slate-300'}`}>{u.name}</div>
                                                <div className="text-[9px] text-slate-500">{u.role} · {u.groupId}</div>
                                            </div>
                                        </div>
                                        {adminIds.includes(u.id) && <Check className="w-4 h-4 text-indigo-400" />}
                                    </button>
                                ))}
                             </div>
                            </>
                        )}
                    </div>
                </div>
                {adminIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-2">
                        {adminIds.map(aid => {
                            const u = users.find(user => user.id === aid);
                            return u ? (
                                <div key={aid} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-bold border border-indigo-500/20">
                                    <UserCog className="w-3 h-3"/> {u.name}
                                    <button onClick={() => toggleAdmin(aid)} className="hover:text-white"><X className="w-3 h-3"/></button>
                                </div>
                            ) : null;
                        })}
                    </div>
                )}
              </section>

              <section className="space-y-6">
                <div className="flex items-center justify-between px-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">字段架构预览</label>
                  <button onClick={addColumn} className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-white transition-colors">
                    <Plus className="w-3 h-3"/> 新增字段
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {columns.map((col, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center gap-4 group hover:border-white/20 transition-all">
                      <div className="flex-1 flex items-center gap-6">
                        <div className="flex-1 flex items-center gap-4">
                           <input 
                            value={col.label}
                            onChange={e => updateColumn(idx, { label: e.target.value })}
                            className="flex-1 bg-transparent border-none text-xs font-black text-white focus:ring-0"
                            placeholder="字段名"
                          />
                        </div>
                        <div className="flex gap-1">
                          {[FieldType.TEXT, FieldType.NUMBER, FieldType.SELECT, FieldType.DATE].map(t => (
                            <button 
                              key={t}
                              onClick={() => updateColumn(idx, { type: t })}
                              className={`p-2 rounded-lg border transition-all ${col.type === t ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-transparent border-white/5 text-slate-600 hover:text-slate-400'}`}
                            >
                              {t === FieldType.TEXT && <Type className="w-3.5 h-3.5"/>}
                              {t === FieldType.NUMBER && <Hash className="w-3.5 h-3.5"/>}
                              {t === FieldType.SELECT && <List className="w-3.5 h-3.5"/>}
                              {t === FieldType.DATE && <Calendar className="w-3.5 h-3.5"/>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => removeColumn(idx)} className="p-3 text-slate-700 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:col-span-1 space-y-10">
              <section className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">角色组准入配置</label>
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-3">
                  <p className="text-[10px] text-slate-500 font-bold mb-4">勾选参与此业务的角色，权限矩阵将仅显示已选角色。</p>
                  {INITIAL_GROUPS.map(g => {
                    const isSelected = activeGroupIds.includes(g.id);
                    return (
                      <button 
                        key={g.id}
                        onClick={() => toggleGroup(g.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${isSelected ? 'bg-indigo-600/10 border-indigo-500/50 text-white' : 'bg-transparent border-white/5 text-slate-600 hover:border-white/10'}`}
                      >
                        <div className={`w-3 h-3 rounded-full ${isSelected ? g.color : 'bg-slate-800'}`} />
                        <span className="flex-1 text-left text-xs font-black uppercase tracking-widest">{g.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {!initialData && (
                <section className="space-y-4">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">快速初始化</label>
                   <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/[0.02] hover:bg-indigo-500/5 rounded-[2rem] p-8 transition-all text-center"
                  >
                    <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx, .xls" className="hidden" />
                    <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto mb-4" />
                    <h3 className="text-xs font-black text-white">从 Excel 自动建模</h3>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        <div className="p-10 border-t border-white/5 flex justify-end gap-4">
          <button onClick={onCancel} className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase hover:text-white">取消</button>
          <button onClick={handleSave} className="flex items-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl transition-all">
            <Save className="w-5 h-5"/> 部署业务系统
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateDesigner;
