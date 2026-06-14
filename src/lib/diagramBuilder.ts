import dagre from '@dagrejs/dagre';
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { XsdSchema, XsdContent, XsdParticle, SelectedItem } from '../types/xsd';

export interface DiagramNodeData extends Record<string, unknown> {
  nodeKind: 'root' | 'element' | 'compositor' | 'attr' | 'groupRef' | 'any';
  label: string;
  typeName?: string;
  compositorKind?: 'sequence' | 'choice' | 'all';
  minOccurs?: string;
  maxOccurs?: string;
  resolvedItem?: SelectedItem;
}

function occ(min: string, max: string): string {
  if (min === '1' && max === '1') return '';
  if (min === '0' && max === '1') return '0..1';
  if (min === '0' && max === 'unbounded') return '0..∞';
  if (min === '1' && max === 'unbounded') return '1..∞';
  return `${min}..${max}`;
}

function stripNs(q: string) {
  const i = q.lastIndexOf(':');
  return i >= 0 ? q.slice(i + 1) : q;
}

function resolveRef(type: string, schema: XsdSchema): SelectedItem | undefined {
  const n = stripNs(type);
  if (schema.complexTypes.some((t) => t.name === n)) return { kind: 'complexType', name: n };
  if (schema.simpleTypes.some((t) => t.name === n)) return { kind: 'simpleType', name: n };
  if (schema.elements.some((e) => e.name === n)) return { kind: 'element', name: n };
  if (schema.groups.some((g) => g.name === n)) return { kind: 'group', name: n };
  return undefined;
}

let _seq = 0;
const uid = () => `d${_seq++}`;

function edgeTo(src: string, tgt: string, label?: string, style?: React.CSSProperties): Edge {
  return {
    id: `${src}->${tgt}`,
    source: src,
    target: tgt,
    type: 'smoothstep',
    label: label || undefined,
    labelStyle: { fontSize: 10, fill: '#a6adc8' },
    style: { stroke: '#45475a', ...style },
    markerEnd: { type: MarkerType.Arrow, color: '#45475a', width: 14, height: 14 },
  };
}

function addComp(
  nodes: Node<DiagramNodeData>[],
  edges: Edge[],
  parentId: string,
  kind: 'sequence' | 'choice' | 'all',
  min = '1',
  max = '1',
): string {
  const id = uid();
  nodes.push({
    id,
    type: 'dnComp',
    data: { nodeKind: 'compositor', label: kind, compositorKind: kind, minOccurs: min, maxOccurs: max },
    position: { x: 0, y: 0 },
  });
  edges.push(edgeTo(parentId, id, occ(min, max) || undefined));
  return id;
}

function walkParticles(
  particles: XsdParticle[],
  parentId: string,
  nodes: Node<DiagramNodeData>[],
  edges: Edge[],
  schema: XsdSchema,
  depth: number,
) {
  if (depth > 6) return; // guard against extremely deep schemas
  for (const p of particles) {
    if (p.kind === 'element') {
      const el = p.element;
      const id = uid();
      const label = el.ref ? `ref:${stripNs(el.ref)}` : el.name || '?';
      const typeName = el.type ? stripNs(el.type) : undefined;
      const resolvedItem = el.type ? resolveRef(el.type, schema) : undefined;
      nodes.push({
        id,
        type: 'dnElement',
        data: { nodeKind: 'element', label, typeName, resolvedItem, minOccurs: p.minOccurs, maxOccurs: p.maxOccurs },
        position: { x: 0, y: 0 },
      });
      edges.push(edgeTo(parentId, id, occ(p.minOccurs, p.maxOccurs) || undefined));
      // Expand inline anonymous complexType
      if (el.complexType) walkContent(el.complexType.content, id, nodes, edges, schema, depth + 1);
    } else if (p.kind === 'sequence') {
      const cid = addComp(nodes, edges, parentId, 'sequence', p.minOccurs, p.maxOccurs);
      walkParticles(p.particles, cid, nodes, edges, schema, depth + 1);
    } else if (p.kind === 'choice') {
      const cid = addComp(nodes, edges, parentId, 'choice', p.minOccurs, p.maxOccurs);
      walkParticles(p.particles, cid, nodes, edges, schema, depth + 1);
    } else if (p.kind === 'group') {
      const id = uid();
      nodes.push({
        id,
        type: 'dnGroup',
        data: { nodeKind: 'groupRef', label: stripNs(p.ref), minOccurs: p.minOccurs, maxOccurs: p.maxOccurs },
        position: { x: 0, y: 0 },
      });
      edges.push(edgeTo(parentId, id, occ(p.minOccurs, p.maxOccurs) || undefined));
    } else if (p.kind === 'any') {
      const id = uid();
      nodes.push({
        id,
        type: 'dnAny',
        data: { nodeKind: 'any', label: 'any', typeName: p.namespace, minOccurs: p.minOccurs, maxOccurs: p.maxOccurs },
        position: { x: 0, y: 0 },
      });
      edges.push(edgeTo(parentId, id, occ(p.minOccurs, p.maxOccurs) || undefined, { strokeDasharray: '4 3' }));
    }
  }
}

function walkContent(
  content: XsdContent,
  parentId: string,
  nodes: Node<DiagramNodeData>[],
  edges: Edge[],
  schema: XsdSchema,
  depth: number,
) {
  if (depth > 7) return;
  switch (content.kind) {
    case 'sequence': {
      const cid = addComp(nodes, edges, parentId, 'sequence');
      walkParticles(content.particles, cid, nodes, edges, schema, depth + 1);
      break;
    }
    case 'choice': {
      const cid = addComp(nodes, edges, parentId, 'choice', content.minOccurs, content.maxOccurs);
      walkParticles(content.particles, cid, nodes, edges, schema, depth + 1);
      break;
    }
    case 'all': {
      const cid = addComp(nodes, edges, parentId, 'all');
      walkParticles(content.particles, cid, nodes, edges, schema, depth + 1);
      break;
    }
    case 'group': {
      const id = uid();
      nodes.push({
        id,
        type: 'dnGroup',
        data: { nodeKind: 'groupRef', label: stripNs(content.ref) },
        position: { x: 0, y: 0 },
      });
      edges.push(edgeTo(parentId, id));
      break;
    }
    case 'complexContent': {
      const baseId = uid();
      const resolved = resolveRef(content.base, schema);
      nodes.push({
        id: baseId,
        type: 'dnElement',
        data: { nodeKind: 'element', label: stripNs(content.base), typeName: content.derivation, resolvedItem: resolved },
        position: { x: 0, y: 0 },
      });
      const color = content.derivation === 'extension' ? '#89b4fa' : '#f38ba8';
      edges.push({
        ...edgeTo(parentId, baseId, content.derivation),
        style: { stroke: color, strokeDasharray: '5 3' },
        labelStyle: { fill: color, fontSize: 10 },
        markerEnd: { type: MarkerType.Arrow, color, width: 14, height: 14 },
      });
      if (content.inner.kind !== 'empty') {
        walkContent(content.inner, baseId, nodes, edges, schema, depth + 1);
      }
      break;
    }
    case 'simpleContent': {
      const id = uid();
      const resolved = resolveRef(content.base, schema);
      nodes.push({
        id,
        type: 'dnElement',
        data: { nodeKind: 'element', label: stripNs(content.base), typeName: content.derivation, resolvedItem: resolved },
        position: { x: 0, y: 0 },
      });
      edges.push(edgeTo(parentId, id, content.derivation, { stroke: '#89b4fa', strokeDasharray: '5 3' }));
      break;
    }
    case 'empty':
      break;
  }
}

function layout(nodes: Node<DiagramNodeData>[], edges: Edge[]): Node<DiagramNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 55, nodesep: 14, marginx: 24, marginy: 24 });

  for (const n of nodes) {
    const isComp = n.type === 'dnComp';
    const lbl = n.data.label as string;
    const w = isComp ? 38 : Math.max(110, lbl.length * 8.5 + 32);
    const h = isComp ? 38 : n.data.typeName ? 52 : 36;
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    const isComp = n.type === 'dnComp';
    const lbl = n.data.label as string;
    const w = isComp ? 38 : Math.max(110, lbl.length * 8.5 + 32);
    const h = isComp ? 38 : n.data.typeName ? 52 : 36;
    return { ...n, position: { x: p.x - w / 2, y: p.y - h / 2 } };
  });
}

export function buildDiagram(
  selected: SelectedItem,
  schema: XsdSchema,
): { nodes: Node<DiagramNodeData>[]; edges: Edge[] } {
  _seq = 0;
  const nodes: Node<DiagramNodeData>[] = [];
  const edges: Edge[] = [];

  const rootId = uid();

  if (selected.kind === 'element') {
    const el = schema.elements.find((e) => e.name === selected.name);
    if (!el) return { nodes: [], edges: [] };
    nodes.push({
      id: rootId,
      type: 'dnRoot',
      data: { nodeKind: 'root', label: el.name, typeName: el.type ? stripNs(el.type) : 'element' },
      position: { x: 0, y: 0 },
    });
    if (el.complexType) {
      walkContent(el.complexType.content, rootId, nodes, edges, schema, 0);
      for (const a of el.complexType.attributes) {
        if (!a.name && !a.ref) continue;
        const aid = uid();
        nodes.push({
          id: aid,
          type: 'dnAttr',
          data: { nodeKind: 'attr', label: `@${a.name ?? a.ref}`, typeName: a.type ? stripNs(a.type) : undefined, minOccurs: a.use === 'required' ? '1' : '0', maxOccurs: '1' },
          position: { x: 0, y: 0 },
        });
        edges.push(edgeTo(rootId, aid, undefined, { stroke: '#94e2d5', strokeDasharray: '3 2' }));
      }
    } else if (el.type) {
      const ct = schema.complexTypes.find((t) => t.name === stripNs(el.type!));
      if (ct) {
        walkContent(ct.content, rootId, nodes, edges, schema, 0);
        for (const a of ct.attributes) {
          if (!a.name && !a.ref) continue;
          const aid = uid();
          nodes.push({
            id: aid,
            type: 'dnAttr',
            data: { nodeKind: 'attr', label: `@${a.name ?? a.ref}`, typeName: a.type ? stripNs(a.type) : undefined },
            position: { x: 0, y: 0 },
          });
          edges.push(edgeTo(rootId, aid, undefined, { stroke: '#94e2d5', strokeDasharray: '3 2' }));
        }
      }
    }
  } else if (selected.kind === 'complexType') {
    const ct = schema.complexTypes.find((t) => t.name === selected.name);
    if (!ct) return { nodes: [], edges: [] };
    nodes.push({
      id: rootId,
      type: 'dnRoot',
      data: { nodeKind: 'root', label: ct.name ?? '', typeName: 'complexType' },
      position: { x: 0, y: 0 },
    });
    walkContent(ct.content, rootId, nodes, edges, schema, 0);
    for (const a of ct.attributes) {
      if (!a.name && !a.ref) continue;
      const aid = uid();
      nodes.push({
        id: aid,
        type: 'dnAttr',
        data: { nodeKind: 'attr', label: `@${a.name ?? a.ref}`, typeName: a.type ? stripNs(a.type) : undefined, minOccurs: a.use === 'required' ? '1' : '0', maxOccurs: '1' },
        position: { x: 0, y: 0 },
      });
      edges.push(edgeTo(rootId, aid, undefined, { stroke: '#94e2d5', strokeDasharray: '3 2' }));
    }
  } else if (selected.kind === 'group') {
    const grp = schema.groups.find((g) => g.name === selected.name);
    if (!grp) return { nodes: [], edges: [] };
    nodes.push({
      id: rootId,
      type: 'dnRoot',
      data: { nodeKind: 'root', label: grp.name, typeName: 'group' },
      position: { x: 0, y: 0 },
    });
    walkContent(grp.content, rootId, nodes, edges, schema, 0);
  }

  return { nodes: layout(nodes, edges), edges };
}
