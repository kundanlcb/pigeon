import { useCallback, useEffect } from 'react';
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
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Plus, Trash2, ArrowLeft } from 'lucide-react';

function RequestNodeComponent({ data, id }: { data: any, id: string }) {
  const collections = useStore(state => state.collections);
  const updateFlow = useStore(state => state.updateFlow);
  const activeFlowId = useStore(state => state.activeFlowId);
  const flows = useStore(state => state.flows);
  const activeFlow = flows.find(f => f.id === activeFlowId);
  
  let request: RequestItem | undefined;
  for (const c of collections) {
    const found = c.requests.find(r => r.id === data.requestId);
    if (found) request = found;
  }

  const allRequests = collections.flatMap(c => c.requests);

  const handleRequestSelect = (reqId: string) => {
    if (!activeFlow) return;
    const newNodes = activeFlow.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, requestId: reqId } } : n);
    updateFlow(activeFlow.id, { nodes: newNodes });
  };

  return (
    <div className="bg-panel-bg border border-border-strong rounded-lg shadow-xl p-3 min-w-[240px] text-[13px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-accent border-2 border-panel-bg" />
      
      <div className="font-semibold text-text-primary mb-2 flex items-center justify-between">
        <span>Request Step</span>
        {request && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-bg text-accent">
            {request.method}
          </span>
        )}
      </div>
      
      <select 
        className="w-full bg-surface-bg text-text-primary border border-border-strong rounded px-2 py-1.5 mb-2 outline-none focus:border-accent"
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
  const addFlow = useStore(state => state.addFlow);
  const deleteFlow = useStore(state => state.deleteFlow);
  const setActiveFlow = useStore(state => state.setActiveFlow);
  const updateFlow = useStore(state => state.updateFlow);

  const activeFlow = flows.find(f => f.id === activeFlowId);

  const [nodes, setNodes, onNodesChange] = useNodesState(activeFlow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeFlow?.edges || []);

  useEffect(() => {
    if (activeFlowId && activeFlow) {
      setNodes(activeFlow.nodes || []);
      setEdges(activeFlow.edges || []);
    }
  }, [activeFlowId]);

  // Sync back to store on changes
  useEffect(() => {
    if (activeFlowId && nodes.length > 0) {
      updateFlow(activeFlowId, { nodes: nodes as any, edges: edges as any });
    }
  }, [nodes, edges]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  if (!activeFlowId) {
    return (
      <div className="flex-1 flex flex-col bg-app-bg p-8">
        <div className="flex justify-between items-center mb-8 max-w-4xl mx-auto w-full">
           <h2 className="text-2xl font-bold text-text-primary">API Automations</h2>
           <button onClick={() => addFlow('New Flow')} className="flex items-center font-medium bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20">
              <Plus size={18} className="mr-2" /> Create Flow
           </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto w-full">
           {flows.length === 0 && (
             <div className="col-span-full text-center py-12 bg-surface-bg border border-border-strong rounded-xl border-dashed">
               <p className="text-text-muted text-lg mb-2">No workflows found</p>
               <p className="text-text-secondary text-sm">Chain multiple requests together visually.</p>
             </div>
           )}
           {flows.map(f => (
             <div key={f.id} onClick={() => setActiveFlow(f.id)} className="p-5 bg-surface-bg border border-border-strong rounded-xl cursor-pointer hover:border-accent hover:shadow-lg transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-text-primary text-lg">{f.name}</h3>
                  <button onClick={(e) => { e.stopPropagation(); deleteFlow(f.id); }} className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="text-sm text-text-secondary">
                  {f.nodes.length} nodes • {f.edges.length} connections
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-app-bg relative">
      <div className="h-14 border-b border-border-subtle flex items-center px-4 justify-between bg-surface-bg z-10 shrink-0">
         <div className="flex items-center space-x-4">
            <button onClick={() => setActiveFlow('')} className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors">
              <ArrowLeft size={18} />
            </button>
            <input 
              value={activeFlow?.name || ''} 
              onChange={(e) => updateFlow(activeFlowId, { name: e.target.value })}
              className="bg-transparent text-text-primary font-semibold text-lg outline-none focus:border-b-2 border-accent px-1"
            />
         </div>
         <div className="flex items-center space-x-3">
            <button onClick={() => {
              const id = `node-${Date.now()}`;
              const newNode = {
                id,
                type: 'requestNode',
                position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 },
                data: { requestId: '' }
              };
              setNodes(nds => [...nds, newNode]);
            }} className="flex items-center text-sm font-medium text-text-secondary hover:text-text-primary px-3 py-1.5 bg-panel-bg border border-border-strong rounded-lg hover:border-text-secondary transition-colors shadow-sm">
              <Plus size={16} className="mr-1.5" /> Add Node
            </button>
            <button className="flex items-center text-sm font-medium bg-accent text-white px-4 py-1.5 rounded-lg hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20">
              <Play size={16} className="mr-1.5 fill-current" /> Run Flow
            </button>
         </div>
      </div>
      <div className="flex-1 w-full h-full">
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
          <Background color="#3f3f46" gap={16} />
          <Controls className="bg-panel-bg border-border-strong fill-text-primary" />
        </ReactFlow>
      </div>
    </div>
  );
}
