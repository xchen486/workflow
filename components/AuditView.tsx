
import React from 'react';
import { AuditLog } from '../types';

interface AuditViewProps {
  logs: AuditLog[];
  rowId: string;
}

const AuditView: React.FC<AuditViewProps> = ({ logs, rowId }) => {
  const filteredLogs = logs.filter(log => log.rowId === rowId).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="mt-4 p-4 bg-slate-50 border rounded-lg max-h-60 overflow-y-auto">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
        Audit History
      </h4>
      {filteredLogs.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No history records found.</p>
      ) : (
        <ul className="space-y-3">
          {filteredLogs.map(log => (
            <li key={log.id} className="text-xs border-l-2 border-slate-200 pl-3 py-1">
              <div className="flex justify-between text-slate-400 mb-1">
                <span>{log.operatorName}</span>
                <span>{new Date(log.timestamp).toLocaleString()}</span>
              </div>
              <div className="text-slate-700">
                Changed <span className="font-semibold">{log.field}</span> from 
                <span className="bg-red-50 text-red-600 px-1 mx-1 rounded">"{log.oldValue}"</span> to 
                <span className="bg-green-50 text-green-600 px-1 mx-1 rounded">"{log.newValue}"</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AuditView;
