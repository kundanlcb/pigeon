import { Variable, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { type FlowNodeExtraction } from '../store';

interface VariableInspectorProps {
  extractions: { nodeId: string; nodeName: string; ext: FlowNodeExtraction }[];
  flowVariables: Record<string, string>;
  runResults: any[];
}

export function VariableInspector({ extractions, flowVariables, runResults }: VariableInspectorProps) {
  return (
    <div className="w-80 h-full bg-panel-bg border-l border-border-strong flex flex-col absolute right-0 top-0 shadow-2xl z-30">
      <div className="p-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Variable size={14} className="text-accent" />
          <h3 className="font-semibold text-text-primary text-xs">Variable Inspector</h3>
        </div>
        <span className="text-text-muted text-[10px]">{extractions.length} Variables</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {extractions.length === 0 ? (
          <div className="text-text-muted text-xs italic text-center mt-10">
            No variables extracted in this flow.
          </div>
        ) : (
          extractions.map(({ nodeId, nodeName, ext }) => {
            const hasRun = runResults.some(r => r.nodeId === nodeId && r.status !== 'pending' && r.requestName !== 'Running...');
            const hasFailedRun = runResults.some(r => r.nodeId === nodeId && r.status === 'error');
            const resolvedValue = flowVariables[ext.variableName];
            
            let status: 'resolved' | 'failed' | 'pending' = 'pending';
            if (resolvedValue !== undefined) status = 'resolved';
            else if (hasRun || hasFailedRun) status = 'failed';
            
            return (
              <div key={ext.id} className="p-2.5 rounded-[4px] border border-border-subtle bg-surface-bg flex flex-col space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="font-mono text-xs font-semibold text-text-primary">
                    {`{{${ext.variableName}}}`}
                  </div>
                  {status === 'resolved' ? (
                    <span title="Resolved"><CheckCircle2 size={13} className="text-emerald-400" /></span>
                  ) : status === 'failed' ? (
                    <span title="Resolution Failed"><XCircle size={13} className="text-red-400" /></span>
                  ) : (
                    <span title="Not yet resolved"><Clock size={13} className="text-text-muted" /></span>
                  )}
                </div>
                
                <div className="text-[10px] text-text-muted flex justify-between">
                  <span>Source: {nodeName}</span>
                  <span className="font-mono bg-surface-hover px-1 rounded truncate max-w-[100px]" title={`${ext.source}: ${ext.path}`}>
                    {ext.source === 'header' ? `hdr:${ext.path}` : ext.path || 'root'}
                  </span>
                </div>
                
                {status === 'resolved' && (
                  <div className="mt-1 pt-1.5 border-t border-border-subtle text-[11px] font-mono text-text-secondary break-all bg-panel-bg p-1.5 rounded">
                    {resolvedValue}
                  </div>
                )}
                {status === 'failed' && (
                  <div className="mt-1 pt-1 border-t border-border-subtle text-[10px] text-red-400 italic">
                    Failed to extract
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
