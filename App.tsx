
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  User, UserRole, TableRow, DataStatus, 
  AuditLog, AccessLevel, Workspace, FieldType, RoleGroup
} from './types';
import { MOCK_USERS as INITIAL_USERS, INITIAL_DATA, WORKSPACES as INITIAL_WORKSPACES, INITIAL_GROUPS } from './constants';
import { canViewRow, getColumnAccess } from './components/AccessControl';
import { analyzeDataWithGemini } from './services/geminiService';
import PolicyView from './components/PolicyView';
import TemplateDesigner from './components/TemplateDesigner';
import { 
  Shield, Search, Plus, 
  Sparkles, Layers, Wrench, Calendar, Lock, Edit2, XCircle,
  Calculator, Users, Cpu, ShoppingCart, Settings,
  Download, Upload, FileSpreadsheet, EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';

type ViewMode = 'GRID' | 'POLICIES';

const IconMap: Record<string, any> = {
  Calculator, Users, Cpu, ShoppingCart
};

const App: React.FC = () => {
  // --- Global States ---
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [groups, setGroups] = useState<RoleGroup[]>(INITIAL_GROUPS);
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
  const [currentView, setCurrentView] = useState<ViewMode>('GRID');
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>(INITIAL_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(INITIAL_WORKSPACES[0].id);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  
  const [data, setData] = useState<TableRow[]>(INITIAL_DATA);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Visibility Logic ---
  // Filter workspaces that are visible to the current user's group
  const visibleWorkspaces = useMemo(() => {
    return workspaces.filter(ws => {
      // Admin sees everything
      if (currentUser.role === UserRole.ADMIN) return true;
      // If no activeGroupIds defined, it's public to all internal users
      if (!ws.activeGroupIds || ws.activeGroupIds.length === 0) return true;
      // Check if user's group is in the allowed list
      return ws.activeGroupIds.includes(currentUser.groupId);
    });
  }, [workspaces, currentUser]);

  // Ensure activeWorkspaceId is valid after visibility changes
  useEffect(() => {
    if (currentView === 'GRID' && !visibleWorkspaces.find(ws => ws.id === activeWorkspaceId)) {
      if (visibleWorkspaces.length > 0) {
        setActiveWorkspaceId(visibleWorkspaces[0].id);
      }
    }
  }, [visibleWorkspaces, activeWorkspaceId, currentView]);

  const activeWorkspace = useMemo(() => 
    workspaces.find(ws => ws.id === activeWorkspaceId) || workspaces[0]
  , [activeWorkspaceId, workspaces]);

  // --- Excel-like Selection State ---
  const [selection, setSelection] = useState<{
    start: { r: number; c: number } | null;
    end: { r: number; c: number } | null;
    isDragging: boolean;
  }>({ start: null, end: null, isDragging: false });

  const [editingCell, setEditingCell] = useState<{ rowId: string, field: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<any>('');
  const [toast, setToast] = useState<{ msg: string, type: 'info' | 'warn' } | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    const updatedSelf = users.find(u => u.id === currentUser.id);
    if (updatedSelf) setCurrentUser(updatedSelf);
  }, [users]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const filteredData = useMemo(() => {
    if (!activeWorkspace) return [];
    return data
      .filter(row => row.workspaceId === activeWorkspaceId)
      .filter(row => {
        const isVisible = canViewRow(currentUser, row, users);
        if (!isVisible) return false;
        const searchableText = Object.values(row).join(' ').toLowerCase();
        return searchableText.includes(searchQuery.toLowerCase());
      });
  }, [data, activeWorkspaceId, currentUser, searchQuery, users, activeWorkspace]);

  const gridColumns = useMemo(() => {
    if (!activeWorkspace) return [];
    return [
      { field: 'status', label: '状态', type: 'status', isSensitive: false },
      ...activeWorkspace.columns
    ];
  }, [activeWorkspace]);

  const isSelected = useCallback((r: number, c: number) => {
    if (!selection.start || !selection.end) return false;
    const minR = Math.min(selection.start.r, selection.end.r);
    const maxR = Math.max(selection.start.r, selection.end.r);
    const minC = Math.min(selection.start.c, selection.end.c);
    const maxC = Math.max(selection.start.c, selection.end.c);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }, [selection]);

  const handleCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0 || e.detail > 1) return;
    setSelection({ start: { r, c }, end: { r, c }, isDragging: true });
    setEditingCell(null);
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (selection.isDragging) {
      setSelection(prev => ({ ...prev, end: { r, c } }));
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (selection.isDragging) setSelection(prev => ({ ...prev, isDragging: false }));
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [selection.isDragging]);

  const performBatchUpdate = useCallback((updates: { rowId: string, field: string, value: any }[]) => {
    const newLogs: AuditLog[] = [];
    let updatedCount = 0;
    let skippedCount = 0;

    setData(prev => {
      return prev.map(row => {
        const rowUpdates = updates.filter(u => u.rowId === row.id);
        if (rowUpdates.length === 0) return row;
        
        let newRow = { ...row };
        let changed = false;
        rowUpdates.forEach(update => {
          const access = getColumnAccess(currentUser, row, update.field, activeWorkspace);
          if (access === AccessLevel.WRITE) {
            const finalVal = update.value === null ? '' : update.value;
            if (String(newRow[update.field]) !== String(finalVal)) {
              newLogs.push({
                id: `L-${Date.now()}-${Math.random()}`,
                rowId: row.id,
                workspaceId: activeWorkspaceId,
                operatorName: currentUser.name,
                field: update.field,
                oldValue: String(newRow[update.field]),
                newValue: String(finalVal),
                timestamp: new Date().toISOString()
              });
              newRow[update.field] = finalVal;
              changed = true;
              updatedCount++;
            }
          } else {
            skippedCount++;
          }
        });
        if (changed) {
          newRow.version++;
          newRow.updatedAt = new Date().toISOString();
          return newRow;
        }
        return row;
      });
    });

    if (newLogs.length > 0) setLogs(prev => [...prev, ...newLogs]);
    if (skippedCount > 0) setToast({ msg: `更新 ${updatedCount}，跳过 ${skippedCount} (权限不足)。`, type: 'warn' });
    else if (updatedCount > 0) setToast({ msg: `成功更新 ${updatedCount} 个单元格。`, type: 'info' });
  }, [currentUser, activeWorkspaceId, activeWorkspace]);

  // --- Keyboard & Paste (Data Grid) ---
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (editingCell) return;
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (!selection.start || !selection.end) return;

      const minR = Math.min(selection.start.r, selection.end.r);
      const maxR = Math.max(selection.start.r, selection.end.r);
      const minC = Math.min(selection.start.c, selection.end.c);
      const maxC = Math.max(selection.start.c, selection.end.c);

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const updates: any[] = [];
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            if (c === 0) continue; 
            if (r < filteredData.length && c < gridColumns.length) {
              updates.push({ rowId: filteredData[r].id, field: gridColumns[c].field, value: '' });
            }
          }
        }
        if (updates.length > 0) performBatchUpdate(updates);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        const rowsText: string[] = [];
        for (let r = minR; r <= maxR; r++) {
          const colValues: string[] = [];
          for (let c = minC; c <= maxC; c++) {
            if (r < filteredData.length && c < gridColumns.length) {
              const field = gridColumns[c].field;
              colValues.push(String(filteredData[r][field] || ''));
            }
          }
          rowsText.push(colValues.join('\t'));
        }
        try {
          await navigator.clipboard.writeText(rowsText.join('\n'));
          setToast({ msg: '已复制到剪贴板', type: 'info' });
        } catch (err) {
          setToast({ msg: '复制失败', type: 'warn' });
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (editingCell) return;
      if (currentView !== 'GRID') return; // 仅在 GRID 视图拦截全局粘贴，PolicyView 有自己的局部处理
      if (!selection.start || !selection.end) return;

      e.preventDefault();
      const text = e.clipboardData?.getData('text');
      if (!text) return;

      let rows = text.split(/\r?\n/);
      if (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
      const clipboardMatrix = rows.map(r => r.split('\t'));
      if (clipboardMatrix.length === 0) return;

      const minR = Math.min(selection.start.r, selection.end.r);
      const maxR = Math.max(selection.start.r, selection.end.r);
      const minC = Math.min(selection.start.c, selection.end.c);
      const maxC = Math.max(selection.start.c, selection.end.c);

      const updates: any[] = [];
      const isSingleCellCopy = clipboardMatrix.length === 1 && clipboardMatrix[0].length === 1;
      const isMultiCellSelection = (maxR - minR > 0) || (maxC - minC > 0);

      if (isSingleCellCopy && isMultiCellSelection) {
        const val = clipboardMatrix[0][0].trim();
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            if (r < filteredData.length && c < gridColumns.length) {
              updates.push({ rowId: filteredData[r].id, field: gridColumns[c].field, value: val });
            }
          }
        }
      } else {
        clipboardMatrix.forEach((rowVals, rOffset) => {
          const targetR = minR + rOffset;
          if (targetR < filteredData.length) {
            rowVals.forEach((val, cOffset) => {
              const targetC = minC + cOffset;
              if (targetC < gridColumns.length) {
                updates.push({ rowId: filteredData[targetR].id, field: gridColumns[targetC].field, value: val.trim() });
              }
            });
          }
        });
      }
      if (updates.length > 0) performBatchUpdate(updates);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    }
  }, [selection, filteredData, gridColumns, editingCell, performBatchUpdate, currentView]);

  // --- Excel Functions ---
  const handleExportExcel = () => {
    const exportData = filteredData.map(row => {
      const exportRow: Record<string, any> = {};
      exportRow['ID'] = row.id;
      exportRow['Status'] = row.status;
      activeWorkspace.columns.forEach(col => { exportRow[col.label] = row[col.field]; });
      return exportRow;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeWorkspace.name);
    XLSX.writeFile(wb, `${activeWorkspace.name}_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
    setToast({ msg: "Export Successful", type: 'info' });
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const newRows: TableRow[] = jsonData.map((row: any) => {
          const newRow: any = {
            id: `R-IMP-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            workspaceId: activeWorkspaceId,
            status: DataStatus.DRAFT,
            ownerId: currentUser.id,
            version: 1,
            updatedAt: new Date().toISOString()
          };
          activeWorkspace.columns.forEach(col => {
            if (row[col.label] !== undefined) newRow[col.field] = row[col.label];
            else if (row[col.field] !== undefined) newRow[col.field] = row[col.field];
            else newRow[col.field] = col.type === FieldType.NUMBER ? 0 : '';
          });
          return newRow as TableRow;
        });
        setData(prev => [...newRows, ...prev]);
        setToast({ msg: `Imported ${newRows.length} records successfully`, type: 'info' });
      } catch (err) {
        setToast({ msg: "Failed to parse Excel file", type: 'warn' });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0b0e14] text-slate-300 selection:bg-indigo-500/30">
      <aside className="w-full md:w-72 bg-slate-900 border-r border-white/5 flex flex-col shrink-0">
        <div className="p-8 border-b border-white/5 flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-2xl shadow-indigo-500/40"><Layers className="w-6 h-6 text-white" /></div>
          <div><h1 className="font-black text-xl text-white tracking-tighter">TERMINATOR</h1><p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em]">Omni-Grid Engine</p></div>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
          <section>
            <div className="px-4 pb-4 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">业务工作区</span>
              <button onClick={() => { setEditingWorkspace(null); setIsDesignerOpen(true); }} className="p-1 hover:bg-white/5 rounded text-indigo-400" title="新建业务"><Plus className="w-3 h-3"/></button>
            </div>
            
            <div className="space-y-1.5">
              {visibleWorkspaces.length === 0 && (
                <div className="px-4 py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                    <EyeOff className="w-6 h-6 text-slate-600 mx-auto mb-2"/>
                    <p className="text-[10px] text-slate-500 font-bold">无可见业务</p>
                    <p className="text-[8px] text-slate-600 mt-1">当前角色没有被分配到任何工作区可见权限</p>
                </div>
              )}
              {visibleWorkspaces.map(ws => {
                const Icon = IconMap[ws.icon] || Layers;
                return (
                  <div key={ws.id} className="relative group">
                    <button onClick={() => { setActiveWorkspaceId(ws.id); setCurrentView('GRID'); }} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[11px] font-black transition-all ${activeWorkspaceId === ws.id && currentView === 'GRID' ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/10' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}><Icon className={`w-4 h-4 ${activeWorkspaceId === ws.id ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`} /><span>{ws.name.toUpperCase()}</span></button>
                    {/* Only show config button to admin or if explicit permission logic added later. For now let's assume all users in sidebar can see settings button but only admins/owners effectively use it. Or just let it be open. */}
                    {currentUser.role === UserRole.ADMIN && (
                       <button onClick={(e) => { e.stopPropagation(); setEditingWorkspace(ws); setIsDesignerOpen(true); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-indigo-600 opacity-0 group-hover:opacity-100 transition-all z-10" title="配置模型"><Settings className="w-3 h-3" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
             <div className="px-4 pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">系统管理</div>
             {currentUser.role === UserRole.ADMIN ? (
                 <button onClick={() => setCurrentView('POLICIES')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[11px] font-black transition-all ${currentView === 'POLICIES' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:bg-white/5'}`}><Shield className="w-4 h-4" /><span>权限矩阵管理</span></button>
             ) : (
                <div className="px-4 py-2 text-[10px] text-slate-600 italic">仅管理员可访问配置中心</div>
             )}
          </section>
          <section>
            <div className="px-4 pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">身份模拟</div>
            <div className="space-y-1">
              {users.map(u => {
                const group = groups.find(g => g.id === u.groupId);
                return (
                  <button key={u.id} onClick={() => { setCurrentUser(u); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold flex items-center gap-3 transition-all ${currentUser.id === u.id ? 'bg-white/5 text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}><div className={`w-1.5 h-1.5 rounded-full ${u.role === UserRole.ADMIN ? 'bg-red-500' : group?.color || 'bg-slate-500'}`} />{u.name}<span className="ml-auto text-[8px] opacity-40">{group?.name || 'No Group'}</span></button>
                )
              })}
            </div>
          </section>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#0f1219] overflow-hidden">
        {currentView === 'GRID' && activeWorkspace ? (
          <>
            <header className="bg-slate-900 border-b border-white/5 px-8 py-6 flex flex-col md:flex-row justify-between items-center sticky top-0 z-40 gap-4 md:gap-0">
              <div><h2 className="text-2xl font-black text-white tracking-tight">{activeWorkspace.name}</h2><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Multi-Cell Batch Ops Ready</p></div>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white/5 rounded-2xl p-1 border border-white/5">
                  <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls, .csv" className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-400 hover:text-white hover:bg-white/10 transition-all" title="Import Excel"><Upload className="w-3.5 h-3.5" /> Import</button>
                  <div className="w-px h-4 bg-white/10 mx-1"></div>
                  <button onClick={handleExportExcel} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-400 hover:text-white hover:bg-white/10 transition-all" title="Export Excel"><Download className="w-3.5 h-3.5" /> Export</button>
                </div>
                <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" /><input type="text" placeholder="快速搜索数据..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-11 pr-6 py-2.5 bg-white/5 border-none rounded-2xl text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 w-48 lg:w-64 transition-all" /></div>
                <button onClick={() => { 
                  const newRow: TableRow = { id: `R-${Date.now().toString().slice(-4)}`, workspaceId: activeWorkspaceId, status: DataStatus.DRAFT, ownerId: currentUser.id, version: 1, updatedAt: new Date().toISOString() };
                  activeWorkspace.columns.forEach(col => { if (col.type === FieldType.NUMBER) newRow[col.field] = 0; else if (col.type === FieldType.DATE) newRow[col.field] = new Date().toISOString().split('T')[0]; else newRow[col.field] = ''; });
                  setData([newRow, ...data]); 
                }} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[11px] font-black shadow-2xl shadow-indigo-600/40 active:scale-95 transition-all"><Plus className="w-4 h-4" /> 创建任务</button>
              </div>
            </header>

            <div className="flex-1 p-8 overflow-auto select-none" onMouseLeave={() => selection.isDragging && setSelection(prev => ({...prev, isDragging: false}))}>
               <div className="bg-slate-900 border border-white/5 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
                  <table className="w-full border-collapse table-fixed min-w-[1200px]">
                    <thead className="bg-[#141822] sticky top-0 z-20 border-b border-white/10">
                      <tr>
                        <th className="w-16 border-r border-white/5 text-[10px] font-black text-slate-600 text-center uppercase">IDX</th>
                        {gridColumns.map(col => (<th key={col.field} className={`px-6 py-4 text-left border-r border-white/5 last:border-0 text-[10px] font-black text-slate-500 uppercase ${col.field === 'status' ? 'w-32' : ''}`}>{col.label}</th>))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredData.map((row, rIdx) => (
                        <tr key={row.id} className="group/row hover:bg-white/[0.02] transition-colors">
                          <td className="border-r border-white/5 text-center text-[10px] font-bold text-slate-700">{rIdx + 1}</td>
                          {gridColumns.map((col, cIdx) => {
                            const isSelectedCell = isSelected(rIdx, cIdx);
                            const isEditing = editingCell?.rowId === row.id && editingCell?.field === col.field;
                            const val = row[col.field];
                            const access = getColumnAccess(currentUser, row, col.field, activeWorkspace);
                            const isStatus = col.field === 'status';
                            return (
                              <td key={col.field} onMouseDown={(e) => handleCellMouseDown(e, rIdx, cIdx)} onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)} onDoubleClick={() => { if (access === AccessLevel.WRITE) { setEditingCell({ rowId: row.id, field: col.field }); setCellEditValue(val); } }} className={`px-6 py-4 border-r border-white/5 last:border-0 relative text-xs ${access === AccessLevel.READ ? 'opacity-80' : ''} ${isSelectedCell ? 'bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/50 z-10' : ''} cursor-cell`}>
                                {isEditing ? (
                                  <div className="absolute inset-0 z-20 bg-indigo-900 border-2 border-indigo-400 shadow-2xl flex items-center">
                                    {(col.type === FieldType.SELECT || isStatus) ? (
                                      <select autoFocus className="w-full h-full bg-transparent border-none text-white px-4 outline-none appearance-none" value={cellEditValue} onChange={e => { performBatchUpdate([{ rowId: row.id, field: col.field, value: e.target.value }]); setEditingCell(null); }} onBlur={() => setEditingCell(null)}>
                                        {isStatus ? Object.values(DataStatus).map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>) : (col as any).options?.map((opt: string) => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)}
                                      </select>
                                    ) : col.type === FieldType.DATE ? (
                                      <input autoFocus type="date" className="w-full h-full bg-transparent border-none text-white px-4 outline-none [color-scheme:dark]" value={cellEditValue} onChange={e => setCellEditValue(e.target.value)} onBlur={() => { performBatchUpdate([{ rowId: row.id, field: col.field, value: cellEditValue }]); setEditingCell(null); }} onKeyDown={e => { if (e.key === 'Enter') { performBatchUpdate([{ rowId: row.id, field: col.field, value: cellEditValue }]); setEditingCell(null); } }} />
                                    ) : (
                                      <input autoFocus type={col.type === FieldType.NUMBER ? 'number' : 'text'} className="w-full h-full bg-transparent border-none text-white px-4 outline-none" value={cellEditValue} onChange={e => setCellEditValue(e.target.value)} onBlur={() => { performBatchUpdate([{ rowId: row.id, field: col.field, value: cellEditValue }]); setEditingCell(null); }} onKeyDown={e => { if (e.key === 'Enter') { performBatchUpdate([{ rowId: row.id, field: col.field, value: cellEditValue }]); setEditingCell(null); } }} />
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between pointer-events-none">{isStatus ? (<StatusBadge status={val as DataStatus} />) : (<span className={`truncate ${col.isSensitive ? 'blur-md' : ''}`}>{col.type === FieldType.NUMBER && !isNaN(Number(val)) ? `¥${Number(val).toLocaleString()}` : (val || '-')}</span>)}<div className="flex items-center gap-2">{col.type === FieldType.DATE && val && <Calendar className="w-3 h-3 text-slate-600" />}{access === AccessLevel.READ && <Lock className="w-3 h-3 text-slate-700" />}</div></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>

            <footer className="bg-slate-900 border-t border-white/5 px-8 py-6 flex items-center justify-between">
               <div className="flex gap-4 items-center"><div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 text-[10px] font-black text-indigo-400 uppercase tracking-widest">{activeWorkspace.name} · RUNNING</div></div>
               <div className="flex items-center gap-3">
                  <button onClick={() => {
                    const pendingRows = data.filter(r => r.ownerId === currentUser.id && r.status === DataStatus.DRAFT);
                    if (pendingRows.length > 0) {
                      setData(prev => prev.map(r => (r.ownerId === currentUser.id && r.status === DataStatus.DRAFT) ? { ...r, status: DataStatus.PENDING, updatedAt: new Date().toISOString() } : r));
                      setToast({ msg: `已提交流转`, type: 'info' });
                    }
                  }} className="px-6 py-3 bg-white/5 text-slate-400 hover:text-white rounded-2xl text-[11px] font-black border border-white/5 transition-all">提交流转</button>
                  <button onClick={() => analyzeDataWithGemini(filteredData).then(setAiSummary)} className="flex items-center gap-3 px-8 py-3 bg-white text-slate-900 rounded-2xl text-[11px] font-black shadow-2xl active:scale-95 transition-all"><Sparkles className="w-4 h-4" /> 风险预警</button>
               </div>
            </footer>
          </>
        ) : currentView === 'POLICIES' ? (
          <div className="flex-1 overflow-auto bg-[#0b0e14]">
            <PolicyView 
              users={users} 
              workspaces={workspaces} 
              groups={groups} 
              onUpdateUserGroup={(uid, gid) => setUsers(prev => prev.map(u => u.id === uid ? { ...u, groupId: gid } : u))} 
              onAddUser={(u) => setUsers([...users, u])} 
              onDeleteUser={(uid) => setUsers(prev => prev.filter(u => u.id !== uid))} 
              onUpdateUser={(uid, updates) => setUsers(prev => prev.map(u => u.id === uid ? { ...u, ...updates } : u))} 
              onBatchUpdateUsers={(newUsers) => { setUsers(newUsers); setToast({msg: '人员列表已同步', type: 'info'}); }}
              onAddGroup={(g) => setGroups([...groups, g])} 
              onDeleteGroup={(gid) => setGroups(prev => prev.filter(g => g.id !== gid))} 
              onUpdatePermission={(wsId, field, gid, level) => { setWorkspaces(prev => prev.map(ws => { if (ws.id !== wsId) return ws; return { ...ws, columns: ws.columns.map(col => { if (col.field !== field) return col; return { ...col, groupPermissions: { ...col.groupPermissions, [gid]: level } }; }) }; })); }} 
              onUpdateWorkspace={(wsId, updates) => setWorkspaces(prev => prev.map(ws => ws.id === wsId ? { ...ws, ...updates } : ws))} // 新增：传递更新句柄
            />
          </div>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                <div className="p-10 border border-dashed border-white/5 rounded-3xl text-center">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-black text-sm uppercase">Please select a workspace</p>
                </div>
            </div>
        )}
      </main>

      {isDesignerOpen && (
        <TemplateDesigner 
          initialData={editingWorkspace}
          currentUserId={currentUser.id}
          onSave={(ws, importedData) => { 
            if (editingWorkspace) {
               setWorkspaces(prev => prev.map(w => w.id === ws.id ? ws : w));
            } else {
               setWorkspaces([...workspaces, ws]);
               if (importedData) {
                 setData(prev => [...importedData, ...prev]);
               }
               setActiveWorkspaceId(ws.id);
            }
            setIsDesignerOpen(false); 
            setEditingWorkspace(null);
            setCurrentView('GRID'); 
          }}
          onCancel={() => { setIsDesignerOpen(false); setEditingWorkspace(null); }}
        />
      )}

      {aiSummary && <div className="fixed bottom-32 right-12 w-[400px] bg-slate-900 border border-white/10 p-8 rounded-[2rem] shadow-2xl z-50 animate-in slide-in-from-bottom-12"><div className="flex justify-between items-center mb-6"><h3 className="font-black text-white uppercase">审计分析</h3><button onClick={() => setAiSummary(null)}><XCircle className="text-slate-500"/></button></div><div className="text-sm text-slate-400 leading-relaxed prose prose-invert">{aiSummary}</div></div>}
      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-2xl z-[100] animate-in slide-in-from-bottom-4 uppercase tracking-widest">{toast.msg}</div>}
    </div>
  );
};

const StatusBadge: React.FC<{ status: DataStatus }> = ({ status }) => {
  const styles = { [DataStatus.DRAFT]: 'bg-slate-800 text-slate-400', [DataStatus.PENDING]: 'bg-amber-500/20 text-amber-500', [DataStatus.APPROVED]: 'bg-emerald-500/20 text-emerald-500', [DataStatus.REJECTED]: 'bg-rose-500/20 text-rose-500' };
  return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${styles[status]}`}>{status}</span>;
};

export default App;
