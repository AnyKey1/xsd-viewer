import { useEffect, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  Handle, Position,
  type NodeProps, type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { buildDiagram, type DiagramNodeData } from '../lib/diagramBuilder';
import type { XsdSchema, SelectedItem } from '../types/xsd';

/* ── Custom nodes ────────────────────────────────────────────────────────── */

function RootNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  return (
    <div className="dn dn--root">
      <Handle type="source" position={Position.Right} id="r" />
      <div className="dn-name">{data.label as string}</div>
      {data.typeName && <div className="dn-type">{data.typeName as string}</div>}
    </div>
  );
}

function ElementNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  const isOpt = data.minOccurs === '0';
  const isClickable = !!data.resolvedItem;
  return (
    <div className={`dn dn--element${isOpt ? ' dn--optional' : ''}${isClickable ? ' dn--link' : ''}`}>
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <div className="dn-name">{data.label as string}</div>
      {data.typeName && <div className="dn-type">{data.typeName as string}</div>}
    </div>
  );
}

function AttrNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  const isReq = data.minOccurs === '1';
  return (
    <div className={`dn dn--attr${isReq ? ' dn--required' : ''}`}>
      <Handle type="target" position={Position.Left} id="l" />
      <div className="dn-name">{data.label as string}</div>
      {data.typeName && <div className="dn-type">{data.typeName as string}</div>}
    </div>
  );
}

// Compositor: small box with sequence dots (····) or choice/all symbols
function CompNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  const kind = data.compositorKind as 'sequence' | 'choice' | 'all';
  const symbol = kind === 'sequence' ? '····' : kind === 'choice' ? '│┼│' : '⊞';
  const occ = data.minOccurs === '0' ? '?' : '';
  return (
    <div className={`dc dc--${kind}`} title={kind}>
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <span className="dc-sym">{symbol}</span>
      {occ && <span className="dc-occ">{occ}</span>}
    </div>
  );
}

function GroupNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  return (
    <div className="dn dn--group">
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <div className="dn-name">⬢ {data.label as string}</div>
    </div>
  );
}

function AnyNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  return (
    <div className="dn dn--any">
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <div className="dn-name">any</div>
      {data.typeName && <div className="dn-type">{data.typeName as string}</div>}
    </div>
  );
}

const nodeTypes = {
  dnRoot:    RootNode,
  dnElement: ElementNode,
  dnAttr:    AttrNode,
  dnComp:    CompNode,
  dnGroup:   GroupNode,
  dnAny:     AnyNode,
};

/* ── Main component ──────────────────────────────────────────────────────── */

interface Props {
  schema: XsdSchema;
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem) => void;
}

export default function XsdDiagram({ schema, selected, onSelect }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DiagramNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!selected || !['element', 'complexType', 'group'].includes(selected.kind)) {
      setNodes([]); setEdges([]); return;
    }
    const { nodes: n, edges: e } = buildDiagram(selected, schema);
    setNodes(n); setEdges(e);
  }, [selected, schema]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const d = node.data as DiagramNodeData;
      if (d.resolvedItem) onSelect(d.resolvedItem);
    },
    [onSelect],
  );

  if (!selected || !['element', 'complexType', 'group'].includes(selected.kind)) {
    return (
      <div className="detail-empty-state">
        Выберите element, complexType или group в дереве слева
      </div>
    );
  }

  if (nodes.length === 0) {
    return <div className="detail-empty-state">Нет структуры для отображения</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2a2a3d" gap={20} />
        <Controls />
        <MiniMap
          style={{ background: '#181825' }}
          nodeColor={(n) =>
            n.type === 'dnRoot' ? '#89b4fa'
            : n.type === 'dnComp' ? '#6c7086'
            : n.type === 'dnAttr' ? '#94e2d5'
            : n.type === 'dnAny'  ? '#585b70'
            : '#313244'
          }
        />
      </ReactFlow>
      <div className="diagram-legend">
        <span><span className="dl-comp dl-seq">····</span> sequence</span>
        <span><span className="dl-comp dl-choice">│┼│</span> choice</span>
        <span><span className="dl-comp dl-all">⊞</span> all</span>
        <span className="dl-opt">- - -</span> optional
        <span className="dl-attr">@</span> attribute
      </div>
    </div>
  );
}
