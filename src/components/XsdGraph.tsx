import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { buildGraph, type XsdGraphNode } from '../lib/graphBuilder';
import type { XsdSchema, SelectedItem } from '../types/xsd';

interface Props {
  schema: XsdSchema;
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem) => void;
}

function XsdNode({ data, type }: NodeProps<Node<XsdGraphNode>>) {
  const colors: Record<string, string> = {
    xsdComplexType: '#89b4fa',
    xsdSimpleType: '#a6e3a1',
    xsdElement: '#fab387',
    xsdGroup: '#cba6f7',
  };
  const color = colors[type ?? ''] ?? '#cdd6f4';
  const label = data.label as string;
  const doc = data.documentation as string | undefined;
  const meta = data.meta as string;
  const width = Math.max(180, Math.min(300, label.length * 9 + 40));
  return (
    <div className="xsd-node" style={{ borderColor: color, width }}>
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div className="xsd-node-title" title={label} style={{ color }}>{label}</div>
      {meta && <div className="xsd-node-meta">{meta}</div>}
      {doc && <div className="xsd-node-doc" title={doc}>{doc.length > 50 ? doc.slice(0, 50) + '…' : doc}</div>}
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  );
}

const nodeTypes = {
  xsdComplexType: XsdNode,
  xsdSimpleType: XsdNode,
  xsdElement: XsdNode,
  xsdGroup: XsdNode,
};

// Inner component — needs to be inside ReactFlowProvider to use useReactFlow
function GraphInner({ schema, selected, onSelect }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<XsdGraphNode>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(schema);
    setNodes(n);
    setEdges(e);
  }, [schema]);

  // fitView after nodes are painted — short delay lets the DOM measure node sizes
  useEffect(() => {
    if (nodes.length === 0) return;
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 80);
    return () => clearTimeout(t);
  }, [nodes.length, fitView]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const id = node.id;
      if (id.startsWith('ct:'))  onSelect({ kind: 'complexType', name: id.slice(3) });
      else if (id.startsWith('st:'))  onSelect({ kind: 'simpleType', name: id.slice(3) });
      else if (id.startsWith('el:'))  onSelect({ kind: 'element',   name: id.slice(3) });
      else if (id.startsWith('grp:')) onSelect({ kind: 'group',     name: id.slice(4) });
    },
    [onSelect],
  );

  const highlightId = selected
    ? selected.kind === 'complexType' ? `ct:${selected.name}`
    : selected.kind === 'simpleType'  ? `st:${selected.name}`
    : selected.kind === 'element'     ? `el:${selected.name}`
    : selected.kind === 'group'       ? `grp:${selected.name}`
    : null : null;

  const styledNodes = nodes.map((n) => ({
    ...n,
    style: { ...n.style, opacity: highlightId && n.id !== highlightId ? 0.35 : 1, transition: 'opacity 0.2s' },
  }));

  if (nodes.length === 0) {
    return <div className="graph-empty"><p>Граф пуст — нет глобальных типов или элементов</p></div>;
  }

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      minZoom={0.05}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#313244" gap={20} />
      <Controls />
      <MiniMap
        nodeColor={(n) => ({ xsdComplexType: '#89b4fa', xsdSimpleType: '#a6e3a1', xsdElement: '#fab387', xsdGroup: '#cba6f7' })[n.type ?? ''] ?? '#6c7086'}
        style={{ background: '#181825' }}
      />
      {/* Panel stays inside the ReactFlow viewport — never overlaps the sidebar */}
      <Panel position="bottom-right" style={{ display: 'flex', gap: 10, fontSize: 11, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', pointerEvents: 'none' }}>
        <span style={{ color: '#89b4fa' }}>■ complexType</span>
        <span style={{ color: '#a6e3a1' }}>■ simpleType</span>
        <span style={{ color: '#fab387' }}>■ element</span>
        <span style={{ color: '#cba6f7' }}>■ group</span>
      </Panel>
    </ReactFlow>
  );
}

export default function XsdGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
