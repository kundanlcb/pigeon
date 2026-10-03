import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, type RequestItem } from '../store';
import { 
  ReactFlow, 
  Controls, 
  ControlButton,
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
import { 
  Play, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Workflow, 
  Globe, 
  ChevronDown, 
  Check, 
  ListFilter,
  Copy,
  Trash2,
  Unlink,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Link
} from 'lucide-react';
import { 
  topologicalSort, 
  getFlowExecutionStages, 
  executeRequestNode, 
  type FlowRunResult 
} from '../utils/automation';
import { MethodIcon } from './MethodIcon';
import { EnvironmentSelector } from './EnvironmentSelector';

interface AutomationViewProps {
  onManageEnvClick?: () => void;
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

function RequestNodeComponent({ data, id, selected }: { data: any, id: string, selected?: boolean }) {
  const collections = useStore(state => state.collections);
  const flows = useStore(state => state.flows);
  const activeFlowId = useStore(state => state.activeFlowId);
  const { updateNodeData } = useReactFlow();

  const activeFlow = flows.find(f => f.id === activeFlowId);
  const scopedCollectionId = activeFlow?.collectionId;

  // Filter collections if a specific collection is scoped for this flow
  const visibleCollections = scopedCollectionId 
    ? collections.filter(c => c.id === scopedCollectionId)
    : collections;

  let request: RequestItem | undefined;
  for (const c of collections) {
    const found = c.requests.find(r => r.id === data.requestId);
    if (found) {
      request = found;
      break;
    }
  }

  const handleRequestSelect = (reqId: string) => {
    updateNodeData(id, { requestId: reqId });
  };

  const continueOnError = data?.continueOnError ?? false;

  return (
    <div 
      className={`bg-panel-bg border ${
        selected 
          ? 'border-accent shadow-lg shadow-accent/15 ring-1 ring-accent/40' 
          : 'border-border-strong hover:border-text-secondary/40'
      } rounded-[6px] p-2.5 box-border w-full h-full min-w-[180px] min-h-[60px] flex flex-col justify-between overflow-hidden text-[13px] transition-all relative select-none`}
    >
      {/* NodeResizer with border lines hidden - allows free resizing without outer bounding box */}
      <NodeResizer 
        nodeId={id}
        minWidth={180} 
        minHeight={60} 
        isVisible={selected} 
        lineStyle={{ display: 'none' }} 
        handleClassName="!bg-accent !border-2 !border-panel-bg !w-2.5 !h-2.5 !rounded-full shadow-md hover:scale-125 transition-transform" 
      />

      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-panel-bg !rounded-full hover:scale-125 transition-transform" 
      />
      
      {/* Request Selector row with inline Method Icon and optional continueOnError badge */}
      <div className="flex items-center gap-1.5 mb-1.5 min-w-0 w-full overflow-hidden">
        {request && (
          <MethodIcon method={request.method} className="mr-1.5" />
        )}
        <select 
          className="nodrag flex-1 min-w-0 max-w-full bg-surface-bg text-text-primary border border-border-strong rounded-[4px] px-2 py-1 text-xs outline-none focus:border-accent cursor-pointer transition-colors truncate"
          value={data.requestId || ''}
          onChange={(e) => handleRequestSelect(e.target.value)}
        >
          <option value="" disabled>Select a Request...</option>
          {visibleCollections.map(c => (
            <optgroup key={c.id} label={c.name}>
              {c.requests.map(req => (
                <option key={req.id} value={req.id}>
                  {req.name} ({req.method})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {continueOnError && (
          <span 
            className="shrink-0 text-[9px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1 py-0.5 rounded-[3px]"
            title="Step will continue flow on error"
          >
            CONT
          </span>
        )}
      </div>
      
      {/* URL Preview with strict truncation so long URLs never expand card width */}
      <div className="w-full min-w-0 max-w-full overflow-hidden">
        {request ? (
          <div 
            className="text-[11px] font-mono text-text-muted truncate w-full min-w-0 block px-2 py-1 bg-surface-bg/70 rounded-[4px] border border-border-subtle/50" 
            title={request.url}
          >
            {request.url || 'No URL configured'}
          </div>
        ) : (
          <div className="text-[11px] text-text-muted/50 italic px-1 py-0.5 truncate">
            No request attached
          </div>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-panel-bg !rounded-full hover:scale-125 transition-transform" 
      />
    </div>
  );
}

const nodeTypes = {
  requestNode: RequestNodeComponent,
};

function FlowCanvasControls() {
  const { zoomTo } = useReactFlow();

  return (
    <Controls className="!bg-panel-bg !border-border-strong !rounded-[4px] overflow-hidden shadow-lg">
      <ControlButton 
        onClick={() => zoomTo(1, { duration: 250 })} 
        title="Reset Zoom (100%)"
        aria-label="Reset zoom to 100%"
        className="!border-t !border-border-subtle hover:!bg-surface-hover"
      >
        <RotateCcw size={12} className="text-text-secondary hover:text-text-primary" />
      </ControlButton>
    </Controls>
  );
}

export function AutomationView({ onManageEnvClick }: AutomationViewProps) {
  const flows = useStore(state => state.flows);
  const activeFlowId = useStore(state => state.activeFlowId);
  const setActiveFlow = useStore(state => state.setActiveFlow);
  const updateFlow = useStore(state => state.updateFlow);
  const collections = useStore(state => state.collections);

  const setActiveRequest = useStore(state => state.setActiveRequest);
  const setActiveView = useStore(state => state.setActiveView);

  const activeFlow = flows.find(f => f.id === activeFlowId);

  const [nodes, setNodes, onNodesChange] = useNodesState(activeFlow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeFlow?.edges || []);
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<FlowRunResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  const [isColDropdownOpen, setIsColDropdownOpen] = useState(false);
  const colDropdownRef = useRef<HTMLDivElement>(null);

  // Modern Node Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close dropdowns and context menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (colDropdownRef.current && !colDropdownRef.current.contains(e.target as Node)) {
        setIsColDropdownOpen(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsColDropdownOpen(false);
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  // Execute Flow with Parallel Stages & Failure Policy Support
  const handleRunFlow = async () => {
    if (!activeFlow) return;
    setIsRunning(true);
    setRunResults([]);
    setLogs([]);
    setShowResults(true);

    const isParallel = activeFlow.parallelExecution !== false; // parallel by default
    const globalContinueOnError = activeFlow.continueOnError ?? false;
    const flowVariables: Record<string, string> = {};

    setLogs(l => [
      ...l, 
      `[Flow Runner] Starting execution in ${isParallel ? 'Parallel' : 'Sequential'} mode (Stop on error: ${!globalContinueOnError})`
    ]);

    if (isParallel) {
      // Group graph nodes into dependency-resolved parallel stages
      const stages = getFlowExecutionStages(activeFlow.nodes, activeFlow.edges);

      for (let s = 0; s < stages.length; s++) {
        const stage = stages[s].filter(n => n.type === 'requestNode' && n.data?.requestId);
        if (stage.length === 0) continue;

        setLogs(l => [...l, `[Stage ${s + 1}] Executing ${stage.length} request(s) concurrently...`]);

        // Mark all nodes in this stage as "Running..."
        setRunResults(prev => {
          const copy = [...prev];
          for (const node of stage) {
            const idx = copy.findIndex(r => r.nodeId === node.id);
            const placeholder: FlowRunResult = {
              nodeId: node.id,
              requestId: node.data.requestId,
              requestName: 'Running...',
              status: 'success'
            };
            if (idx >= 0) copy[idx] = placeholder;
            else copy.push(placeholder);
          }
          return copy;
        });

        // Execute all nodes in this stage in parallel!
        const stageResults = await Promise.all(
          stage.map(node => executeRequestNode(node, (msg) => setLogs(l => [...l, msg]), flowVariables))
        );

        // Update results for all nodes in this stage
        setRunResults(prev => {
          const copy = [...prev];
          for (const res of stageResults) {
            const idx = copy.findIndex(r => r.nodeId === res.nodeId);
            if (idx >= 0) copy[idx] = res;
            else copy.push(res);
          }
          return copy;
        });

        // Check if any node in this stage failed
        const failedNodes = stageResults.filter(r => r.status === 'error');
        if (failedNodes.length > 0) {
          const shouldStop = failedNodes.some(failed => {
            const nodeDef = stage.find(n => n.id === failed.nodeId);
            const nodeAllowsContinue = nodeDef?.data?.continueOnError ?? false;
            return !nodeAllowsContinue && !globalContinueOnError;
          });

          if (shouldStop) {
            setLogs(l => [...l, `[Flow Runner] Stopped: One or more steps failed in Stage ${s + 1}`]);
            break;
          } else {
            setLogs(l => [...l, `[Flow Runner] Continuing to next stage despite step errors`]);
          }
        }
      }
    } else {
      // Sequential topological execution
      const sortedNodes = topologicalSort(activeFlow.nodes, activeFlow.edges);
      const requestNodes = sortedNodes.filter(n => n.type === 'requestNode' && n.data?.requestId);

      for (const node of requestNodes) {
        setRunResults(prev => [...prev, { nodeId: node.id, requestId: node.data.requestId, requestName: 'Running...', status: 'success' } as any]);
        const result = await executeRequestNode(node, (msg) => setLogs(l => [...l, msg]), flowVariables);
        setRunResults(prev => {
          const copy = [...prev];
          const idx = copy.findIndex(r => r.nodeId === node.id);
          if (idx >= 0) copy[idx] = result;
          else copy.push(result);
          return copy;
        });

        if (result.status === 'error') {
          const nodeAllowsContinue = node.data?.continueOnError ?? false;
          if (!nodeAllowsContinue && !globalContinueOnError) {
            setLogs(l => [...l, `[Flow Runner] Stopped: Step ${result.requestName} failed`]);
            break;
          } else {
            setLogs(l => [...l, `[Flow Runner] Continuing execution after failed step`]);
          }
        }
      }
    }

    setLogs(l => [...l, `[Flow Runner] Execution finished`]);
    setIsRunning(false);
  };

  // Run single node from context menu
  const handleRunSingleNode = async (nodeId: string) => {
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode || targetNode.type !== 'requestNode' || !targetNode.data?.requestId) return;

    setShowResults(true);
    setLogs(l => [...l, `[Single Step] Running node ${nodeId}...`]);
    setRunResults(prev => {
      const copy = prev.filter(r => r.nodeId !== nodeId);
      return [...copy, { nodeId, requestId: targetNode.data.requestId, requestName: 'Running...', status: 'success' } as any];
    });

    const flowVariables: Record<string, string> = {};
    const res = await executeRequestNode(targetNode, (msg) => setLogs(l => [...l, msg]), flowVariables);
    setRunResults(prev => {
      const copy = prev.filter(r => r.nodeId !== nodeId);
      return [...copy, res];
    });
  };

  // Context menu actions with immediate store sync
  const targetContextMenuNode = contextMenu ? nodes.find(n => n.id === contextMenu.nodeId) : null;
  let targetNodeRequest: RequestItem | undefined;
  if (targetContextMenuNode?.data?.requestId) {
    for (const c of collections) {
      const found = c.requests.find(r => r.id === targetContextMenuNode.data.requestId);
      if (found) { targetNodeRequest = found; break; }
    }
  }

  const handleDuplicateNode = (nodeId: string) => {
    if (!activeFlowId) return;
    const target = nodes.find(n => n.id === nodeId);
    if (!target) return;
    const newId = `node-${Date.now()}`;
    const duplicatedNode = {
      ...target,
      id: newId,
      position: { x: target.position.x + 30, y: target.position.y + 30 },
      data: { ...target.data }
    };
    const nextNodes = [...nodes, duplicatedNode];
    setNodes(nextNodes);
    updateFlow(activeFlowId, { nodes: nextNodes as any });
    setContextMenu(null);
  };

  const handleUnlinkNode = (nodeId: string) => {
    if (!activeFlowId) return;
    const nextEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    setEdges(nextEdges);
    updateFlow(activeFlowId, { edges: nextEdges as any });
    setContextMenu(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeFlowId) return;
    const nextNodes = nodes.filter(n => n.id !== nodeId);
    const nextEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    setNodes(nextNodes);
    setEdges(nextEdges);
    updateFlow(activeFlowId, { nodes: nextNodes as any, edges: nextEdges as any });
    setContextMenu(null);
  };

  const handleToggleContinueOnError = (nodeId: string) => {
    if (!activeFlowId) return;
    const nextNodes = nodes.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            continueOnError: !n.data?.continueOnError
          }
        };
      }
      return n;
    });
    setNodes(nextNodes);
    updateFlow(activeFlowId, { nodes: nextNodes as any });
    setContextMenu(null);
  };

  const handleOpenInEditor = (requestId?: string) => {
    if (!requestId) return;
    setActiveRequest(requestId);
    setActiveView('editor');
    setContextMenu(null);
  };

  const handleAddNode = () => {
    if (!activeFlowId) return;
    const id = `node-${Date.now()}`;

    // Place node below the lowest node if nodes exist, or at a standard starting position
    let newX = 250;
    let newY = 150;
    if (nodes.length > 0) {
      const maxYNode = nodes.reduce((max, n) => (n.position.y > max.position.y ? n : max), nodes[0]);
      newX = maxYNode.position.x;
      newY = maxYNode.position.y + 110;
    }

    const newNode = {
      id,
      type: 'requestNode',
      position: { x: newX, y: newY },
      width: 260,
      height: 90,
      data: { requestId: '' }
    };

    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    updateFlow(activeFlowId, { nodes: nextNodes as any });
  };


  const selectedCollection = collections.find(c => c.id === activeFlow?.collectionId);
  const totalRequestsCount = collections.reduce((acc, c) => acc + c.requests.length, 0);

  if (!activeFlowId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-app-bg">
        <Workflow size={48} className="mb-4 opacity-20" />
        <p className="text-sm">Select or create a flow to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-app-bg relative">
      {/* Top Header Bar */}
      <div className="h-[44px] border-b border-border-subtle flex items-center px-3 justify-between bg-surface-bg z-10 shrink-0 select-none">
        {/* Left Section: Back button + Flow Name */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setActiveFlow('')} 
            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-[4px] transition-colors"
            title="Back to Flows"
          >
            <ArrowLeft size={15} />
          </button>
          
          <input 
            value={activeFlow?.name || ''} 
            onChange={(e) => updateFlow(activeFlowId, { name: e.target.value })}
            className="bg-transparent text-text-primary font-semibold text-xs outline-none hover:bg-surface-hover/60 focus:bg-surface-hover px-2 py-1 rounded-[4px] border border-transparent focus:border-border-strong transition-all max-w-[200px] truncate"
            title="Edit flow name"
          />
        </div>

        {/* Right Section: Results + Collection + Env + Add Node + Run Flow */}
        <div className="flex items-center space-x-2">

          {/* Results Badge */}
          {runResults.length > 0 && (
            <button
              onClick={() => setShowResults(!showResults)}
              className="flex items-center text-xs font-medium text-text-secondary hover:text-text-primary px-2 py-1 bg-panel-bg border border-border-strong rounded-[4px] hover:border-text-secondary transition-colors shadow-sm"
            >
              {runResults.some(r => r.status === 'error') ? (
                <XCircle size={12} className="text-red-400 mr-1" />
              ) : (
                <CheckCircle2 size={12} className="text-emerald-400 mr-1" />
              )}
              Results ({runResults.filter(r => r.status === 'success').length}/{runResults.length})
            </button>
          )}

          {/* Collection Selector */}
          <div className="relative" ref={colDropdownRef}>
            <button
              onClick={() => {
                setIsColDropdownOpen(!isColDropdownOpen);
              }}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-[4px] text-xs font-medium border border-border-subtle bg-panel-bg/70 hover:bg-panel-bg hover:border-border-strong text-text-secondary hover:text-text-primary transition-all"
              title="Filter flow requests by collection"
            >
              <Globe size={13} className={selectedCollection ? 'text-sky-400' : 'text-text-muted'} />
              <span className="truncate max-w-[110px]">
                {selectedCollection ? selectedCollection.name : 'All Collections'}
              </span>
              <ChevronDown size={11} className="text-text-muted shrink-0" />
            </button>

            {isColDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-panel-bg border border-border-strong rounded-[6px] shadow-2xl overflow-hidden z-50 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Scope Collection
                </div>
                <div 
                  onClick={() => {
                    updateFlow(activeFlowId, { collectionId: undefined });
                    setIsColDropdownOpen(false);
                  }}
                  className={`flex items-center px-2.5 py-1.5 text-xs cursor-pointer ${
                    !activeFlow?.collectionId ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  <ListFilter size={13} className="mr-2 opacity-70" />
                  <span className="flex-1 truncate">All Collections</span>
                  <span className="text-[10px] text-text-muted mr-1.5">({totalRequestsCount})</span>
                  {!activeFlow?.collectionId && <Check size={13} />}
                </div>

                <div className="h-[1px] bg-border-subtle my-1" />

                <div className="max-h-60 overflow-y-auto">
                  {collections.map(col => (
                    <div 
                      key={col.id}
                      onClick={() => {
                        updateFlow(activeFlowId, { collectionId: col.id });
                        setIsColDropdownOpen(false);
                      }}
                      className={`flex items-center px-2.5 py-1.5 text-xs cursor-pointer ${
                        activeFlow?.collectionId === col.id ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mr-2 shrink-0" />
                      <span className="flex-1 truncate">{col.name}</span>
                      <span className="text-[10px] text-text-muted mr-1.5">({col.requests.length})</span>
                      {activeFlow?.collectionId === col.id && <Check size={13} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <EnvironmentSelector onManageClick={onManageEnvClick || (() => {})} />

          {/* Add Node Button */}
          <button 
            onClick={handleAddNode} 
            className="flex items-center text-xs font-medium text-text-primary px-2.5 py-1 bg-panel-bg border border-border-strong rounded-[4px] hover:bg-surface-hover hover:border-text-muted/60 transition-all shadow-sm cursor-pointer"
          >
            <Plus size={13} className="mr-1.5" /> Add Node
          </button>

          {/* Run Flow Button */}
          <button 
            onClick={handleRunFlow}
            disabled={isRunning || !activeFlow?.nodes.length}
            className="flex items-center text-xs font-medium bg-accent text-white px-3 py-1 rounded-[4px] hover:bg-accent-hover active:scale-[0.98] transition-all shadow-md shadow-accent/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isRunning ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Play size={13} className="mr-1.5 fill-current" />}
            {isRunning ? 'Running...' : 'Run Flow'}
          </button>
        </div>
      </div>

      {/* Main Flow Canvas */}
      <div className="flex-1 w-full h-full flex relative">
        <div className="flex-1 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              event.stopPropagation();
              setContextMenu({
                nodeId: node.id,
                x: event.clientX,
                y: event.clientY,
              });
            }}
            onPaneClick={() => setContextMenu(null)}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
            className="bg-app-bg"
          >
            <Background color="#52525b" gap={16} />
            <FlowCanvasControls />
          </ReactFlow>
        </div>
        
        {/* Execution Results Panel */}
        {showResults && (
          <div className="w-80 h-full bg-panel-bg border-l border-border-strong flex flex-col absolute right-0 top-0 shadow-2xl z-20">
            <div className="p-3 border-b border-border-subtle flex justify-between items-center">
              <h3 className="font-semibold text-text-primary text-xs">Execution Results</h3>
              <button 
                onClick={() => setShowResults(false)} 
                className="text-text-muted hover:text-text-primary text-xs"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {runResults.map((r, i) => (
                <div 
                  key={i} 
                  className={`p-2.5 rounded-[4px] border ${
                    r.status === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : r.status === 'error' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-surface-bg border-border-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium flex items-center gap-1.5 text-text-primary text-xs truncate">
                      {r.status === 'success' ? (
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      ) : r.status === 'error' ? (
                        <XCircle size={13} className="text-red-400 shrink-0" />
                      ) : (
                        <Loader2 size={13} className="animate-spin shrink-0" />
                      )}
                      <span className="truncate">{r.requestName}</span>
                    </div>
                    {r.statusCode && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-[3px] font-mono ${
                        r.statusCode < 400 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {r.statusCode}
                      </span>
                    )}
                  </div>
                  {r.error && <div className="text-[11px] text-red-400 mt-1 break-words">{r.error}</div>}
                  {r.timeMs && <div className="text-[10px] text-text-muted mt-1">{r.timeMs.toFixed(1)}ms</div>}
                </div>
              ))}
            </div>
            {logs.length > 0 && (
              <div className="h-44 border-t border-border-strong bg-panel-bg p-2.5 overflow-y-auto font-mono text-[11px] text-text-secondary">
                {logs.map((l, i) => <div key={i} className="leading-tight py-0.5">{l}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modern Custom Context Menu for Flow Nodes */}
      {contextMenu && targetContextMenuNode && createPortal(
        <div 
          className="fixed inset-0 z-[9999]"
          onClick={() => setContextMenu(null)}
          onMouseDown={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div 
            ref={contextMenuRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              left: `${Math.min(Math.max(8, contextMenu.x), window.innerWidth - 240)}px`,
              top: `${Math.min(Math.max(8, contextMenu.y), window.innerHeight - 320)}px`
            }}
            className="absolute w-56 bg-panel-bg border border-border-strong rounded-[6px] shadow-2xl py-1 text-xs text-text-primary z-[10000] select-none animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header info */}
            <div className="px-3 py-1.5 border-b border-border-subtle flex items-center justify-between">
              <span className="font-semibold truncate max-w-[140px] text-text-primary">
                {targetNodeRequest ? targetNodeRequest.name : 'Request Node'}
              </span>
              {targetNodeRequest && (
                <MethodIcon method={targetNodeRequest.method} className="mr-1.5" />
              )}
            </div>

            <div className="p-1 space-y-0.5">
              {/* Execute This Step Only */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunSingleNode(contextMenu.nodeId);
                  setContextMenu(null);
                }}
                className="w-full flex items-center px-2 py-1.5 rounded-[4px] hover:bg-surface-hover text-text-secondary hover:text-text-primary text-left transition-colors"
              >
                <Play size={13} className="mr-2 text-accent" />
                <span className="flex-1">Run This Step</span>
              </button>

              {/* Duplicate Node */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateNode(contextMenu.nodeId);
                }}
                className="w-full flex items-center px-2 py-1.5 rounded-[4px] hover:bg-surface-hover text-text-secondary hover:text-text-primary text-left transition-colors"
              >
                <Copy size={13} className="mr-2 opacity-70" />
                <span className="flex-1">Duplicate Node</span>
              </button>

              {/* Unlink Node Connections */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnlinkNode(contextMenu.nodeId);
                }}
                className="w-full flex items-center px-2 py-1.5 rounded-[4px] hover:bg-surface-hover text-text-secondary hover:text-text-primary text-left transition-colors"
              >
                <Unlink size={13} className="mr-2 opacity-70" />
                <span className="flex-1">Unlink Connections</span>
              </button>

              <div className="h-[1px] bg-border-subtle my-1" />

              {/* Toggle Continue on Failure */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleContinueOnError(contextMenu.nodeId);
                }}
                className="w-full flex items-center px-2 py-1.5 rounded-[4px] hover:bg-surface-hover text-text-secondary hover:text-text-primary text-left transition-colors"
              >
                <AlertTriangle size={13} className="mr-2 text-amber-400 opacity-90" />
                <span className="flex-1">Continue on Failure</span>
                {targetContextMenuNode.data?.continueOnError && (
                  <Check size={13} className="text-amber-400" />
                )}
              </button>

              {/* Open in Request Editor */}
              {targetContextMenuNode.data?.requestId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenInEditor(targetContextMenuNode.data?.requestId);
                  }}
                  className="w-full flex items-center px-2 py-1.5 rounded-[4px] hover:bg-surface-hover text-text-secondary hover:text-text-primary text-left transition-colors"
                >
                  <ExternalLink size={13} className="mr-2 opacity-70" />
                  <span className="flex-1">Open in Editor</span>
                </button>
              )}

              {/* Copy URL */}
              {targetNodeRequest?.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(targetNodeRequest!.url);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center px-2 py-1.5 rounded-[4px] hover:bg-surface-hover text-text-secondary hover:text-text-primary text-left transition-colors"
                >
                  <Link size={13} className="mr-2 opacity-70" />
                  <span className="flex-1">Copy URL</span>
                </button>
              )}

              <div className="h-[1px] bg-border-subtle my-1" />

              {/* Delete Node */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNode(contextMenu.nodeId);
                }}
                className="w-full flex items-center px-2 py-1.5 rounded-[4px] hover:bg-red-500/10 text-red-400 hover:text-red-300 text-left transition-colors"
              >
                <Trash2 size={13} className="mr-2" />
                <span className="flex-1">Delete Node</span>
                <span className="text-[10px] text-text-muted opacity-60">Del</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
