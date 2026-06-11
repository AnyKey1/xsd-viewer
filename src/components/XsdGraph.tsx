import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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
  // Width scales with label length to fit Cyrillic names (wider chars)
  const width = Math.max(180, Math.min(300, label.length * 9 + 40));
  return (
    <div className="xsd-node" style={{ borderColor: color, width }}>
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div className="xsd-node-title" title={label} style={{ color }}>
        {label}
      </div>
      {meta && <div className="xsd-node-meta">{meta}</div>}
      {doc && (
        <div className="xsd-node-doc" title={doc}>
          {doc.length > 50 ? doc.slice(0, 50) + '…' : doc}
        </div>
      )}
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

export default function XsdGraph({ schema, selected, onSelect }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<XsdGraphNode>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(schema);
    setNodes(n);
    setEdges(e);
  }, [schema]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const id = node.id;
      if (id.startsWith('ct:')) onSelect({ kind: 'complexType', name: id.slice(3) });
      else if (id.startsWith('st:')) onSelect({ kind: 'simpleType', name: id.slice(3) });
      else if (id.startsWith('el:')) onSelect({ kind: 'element', name: id.slice(3) });
      else if (id.startsWith('grp:')) onSelect({ kind: 'group', name: id.slice(4) });
    },
    [onSelect],
  );

  const highlightId = selected
    ? selected.kind === 'complexType'
      ? `ct:${selected.name}`
      : selected.kind === 'simpleType'
        ? `st:${selected.name}`
        : selected.kind === 'element'
          ? `el:${selected.name}`
          : selected.kind === 'group'
            ? `grp:${selected.name}`
            : null
    : null;

  const styledNodes = nodes.map((n) => ({
    ...n,
    style: {
      ...n.style,
      opacity: highlightId && n.id !== highlightId ? 0.4 : 1,
      transition: 'opacity 0.2s',
    },
  }));

  if (nodes.length === 0) {
    return (
      <div className="graph-empty">
        <p>Граф пуст — нет глобальных типов или элементов</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={3}
      >
        <Background color="#313244" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const colors: Record<string, string> = {
              xsdComplexType: '#89b4fa',
              xsdSimpleType: '#a6e3a1',
              xsdElement: '#fab387',
              xsdGroup: '#cba6f7',
            };
            return colors[n.type ?? ''] ?? '#6c7086';
          }}
          style={{ background: '#181825' }}
        />
      </ReactFlow>
      <div className="graph-legend">
        <span style={{ color: '#89b4fa' }}>■ complexType</span>
        <span style={{ color: '#a6e3a1' }}>■ simpleType</span>
        <span style={{ color: '#fab387' }}>■ element</span>
        <span style={{ color: '#cba6f7' }}>■ group</span>
      </div>
    </div>
  );
}
