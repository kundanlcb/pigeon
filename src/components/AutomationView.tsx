import { useCallback, useEffect, useState } from 'react';
import { useStore, type RequestItem } from '../store';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  type Connection,
  Position,
  Handle,
  NodeResizer,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, ArrowLeft, Loader2, CheckCircle2, XCircle, Plus, Workflow } from 'lucide-react';
import { topologicalSort, executeRequestNode, type FlowRunResult } from '../utils/automation';

function RequestNodeComponent({ data, id, selected }: { data: any, id: string, selected?: boolean }) {
  const collections = useStore(state => state.collections);
  const { updateNodeData } = useReactFlow();
  
  let request: RequestItem | undefined;
  for (const c of collections) {
    const found = c.requests.find(r => r.id === data.requestId);
    if (found) request = found;
  }

  const allRequests = collections.flatMap(c => c.requests);

  const handleRequestSelect = (reqId: string) => {
    updateNodeData(id, { requestId: reqId });
  };

  return (
    <div className="bg-panel-bg border border-border-strong rounded-lg shadow-xl p-3 w-full h-full flex flex-col text-[13px] overflow-auto">
      <NodeResizer minWidth={180} minHeight={90} isVisible={selected} lineClassName="!border-accent" handleClassName="!bg-accent !border-panel-bg !w-2.5 !h-2.5 !rounded-sm" />
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-accent border-2 border-panel-bg" />
      
      <div className="font-semibold text-text-primary mb-2 flex items-center justify-between shrink-0">
        <span>Request Step</span>
        {request && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-bg text-accent">
            {request.method}
          </span>
        )}
      </div>
      
      <select 
        className="nodrag w-full bg-surface-bg text-text-primary border border-border-strong rounded px-2 py-1.5 mb-2 outline-none focus:border-accent shrink-0"
        value={data.requestId || ''}
        onChange={(e) => handleRequestSelect(e.target.value)}
      >
        <option value="" disabled>Select a Request...</option>
        {allRequests.map(req => (
          <option key={req.id} value={req.id}>{req.name}</option>
        ))}
      </select>
      
      {request && (
         <div className="text-[11px] font-mono text-text-muted truncate w-full" title={request.url}>
           {request.url}
         </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-accent border-2 border-panel-bg" />
    </div>
  );
}

const nodeTypes = {
  requestNode: RequestNodeComponent,
};

export function AutomationView() {
  const flows = useStore(state => state.flows);
  const activeFlowId = useStore(state => state.activeFlowId);
  const setActiveFlow = useStore(state => state.setActiveFlow);
  const updateFlow = useStore(state => state.updateFlow);

  const activeFlow = flows.find(f => f.id === activeFlowId);

  const [nodes, setNodes, onNodesChange] = useNodesState(activeFlow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeFlow?.edges || []);
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<FlowRunResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (activeFlowId && activeFlow) {
      setNodes(activeFlow.nodes || []);
      setEdges(activeFlow.edges || []);
    }
  }, [activeFlowId]);

  // Sync back to store on changes with a debounce to prevent re-render loops while dragging
  useEffect(() => {
    if (activeFlowId && nodes.length > 0) {
      const timeout = setTimeout(() => {
        updateFlow(activeFlowId, { nodes: nodes as any, edges: edges as any });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [nodes, edges, activeFlowId]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleRunFlow = async () => {
    if (!activeFlow) return;
    setIsRunning(true);
    setRunResults([]);
    setLogs([]);
    setShowResults(true);

    const sortedNodes = topologicalSort(activeFlow.nodes, activeFlow.edges);
    const requestNodes = sortedNodes.filter(n => n.type === 'requestNode' && n.data?.requestId);
    const flowVariables: Record<string, string> = {};

    for (const node of requestNodes) {
      setRunResults(prev => [...prev, { nodeId: node.id, requestId: node.data.requestId, requestName: 'Running...', status: 'success' } as any]); // placeholder
      const result = await executeRequestNode(node, (msg) => setLogs(l => [...l, msg]), flowVariables);
      setRunResults(prev => {
        const copy = [...prev];
        const idx = copy.findIndex(r => r.nodeId === node.id);
        if (idx >= 0) copy[idx] = result;
        else copy.push(result);
        return copy;
      });
      if (result.status === 'error') break; // stop on failure for now
    }
    setIsRunning(false);
  };

  if (!activeFlowId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-app-bg">
        <Workflow size={48} className="mb-4 opacity-20" />
        <p>Select or create a flow to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-app-bg relative">
      <div className="h-[44px] border-b border-border-subtle flex items-center px-4 justify-between bg-surface-bg z-10 shrink-0">
         <div className="flex items-center space-x-3">
            <button onClick={() => setActiveFlow('')} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors">
              <ArrowLeft size={16} />
            </button>
            <input 
              value={activeFlow?.name || ''} 
              onChange={(e) => updateFlow(activeFlowId, { name: e.target.value })}
              className="bg-transparent text-text-primary font-semibold text-sm outline-none focus:border-b-2 border-accent px-1"
            />
         </div>
         <div className="flex items-center space-x-2">
            <button onClick={() => {
              const id = `node-${Date.now()}`;
              const offset = (nodes.length % 5) * 20;
              const newNode = {
                id,
                type: 'requestNode',
                position: { x: window.innerWidth / 2 - 100 + offset, y: window.innerHeight / 2 - 100 + offset },
                width: 260,
                height: 180,
                data: { requestId: '' }
              };
              setNodes(nds => [...nds, newNode]);
            }} className="flex items-center text-xs font-medium text-text-secondary hover:text-text-primary px-2.5 py-1 bg-panel-bg border border-border-strong rounded-lg hover:border-text-secondary transition-colors shadow-sm">
              <Plus size={14} className="mr-1.5" /> Add Node
            </button>
            <button 
              onClick={handleRunFlow}
              disabled={isRunning || !activeFlow?.nodes.length}
              className="flex items-center text-xs font-medium bg-accent text-white px-3 py-1 rounded-lg hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 disabled:opacity-50"
            >
              {isRunning ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Play size={14} className="mr-1.5 fill-current" />}
              {isRunning ? 'Running...' : 'Run Flow'}
            </button>
         </div>
      </div>
      <div className="flex-1 w-full h-full flex relative">
        <div className="flex-1 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-app-bg"
          >
            <Background color="#52525b" gap={16} />
            <Controls className="!bg-panel-bg !border-border-strong rounded overflow-hidden shadow-lg" />
          </ReactFlow>
        </div>
        
        {/* Results Panel */}
        {showResults && (
          <div className="w-80 h-full bg-panel-bg border-l border-border-strong flex flex-col absolute right-0 top-0 shadow-2xl z-20">
             <div className="p-3 border-b border-border-subtle flex justify-between items-center">
               <h3 className="font-semibold text-text-primary">Execution Results</h3>
               <button onClick={() => setShowResults(false)} className="text-text-muted hover:text-text-primary">Close</button>
             </div>
             <div className="flex-1 overflow-y-auto p-3 space-y-3">
               {runResults.map((r, i) => (
                 <div key={i} className={`p-3 rounded-lg border ${r.status === 'success' ? 'bg-green-500/10 border-green-500/30' : r.status === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-surface-bg border-border-subtle'}`}>
                   <div className="flex items-center justify-between mb-1">
                     <div className="font-medium flex items-center gap-1.5 text-text-primary">
                       {r.status === 'success' ? <CheckCircle2 size={14} className="text-green-500" /> : r.status === 'error' ? <XCircle size={14} className="text-red-500" /> : <Loader2 size={14} className="animate-spin" />}
                       {r.requestName}
                     </div>
                     {r.statusCode && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${r.statusCode < 400 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {r.statusCode}
                        </span>
                     )}
                   </div>
                   {r.error && <div className="text-xs text-red-400 mt-1.5 break-words">{r.error}</div>}
                   {r.timeMs && <div className="text-[10px] text-text-muted mt-1">{r.timeMs}ms</div>}
                 </div>
               ))}
             </div>
             {logs.length > 0 && (
               <div className="h-48 border-t border-border-strong bg-[#1e1e1e] p-2 overflow-y-auto font-mono text-[11px] text-gray-300">
                 {logs.map((l, i) => <div key={i}>{l}</div>)}
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
