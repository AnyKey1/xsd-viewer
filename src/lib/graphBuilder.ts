import dagre from '@dagrejs/dagre';
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { XsdSchema, XsdContent, XsdParticle } from '../types/xsd';

function stripPrefix(qname: string): string {
  const i = qname.indexOf(':');
  return i >= 0 ? qname.slice(i + 1) : qname;
}

function isBuiltin(name: string): boolean {
  const n = stripPrefix(name);
  return [
    'string', 'integer', 'decimal', 'boolean', 'date', 'dateTime', 'time',
    'long', 'int', 'short', 'byte', 'float', 'double', 'anyURI', 'base64Binary',
    'hexBinary', 'token', 'normalizedString', 'NMTOKEN', 'ID', 'IDREF', 'anyType',
  ].includes(n);
}

function collectTypeRefs(content: XsdContent): string[] {
  const refs: string[] = [];
  switch (content.kind) {
    case 'sequence':
    case 'all':
      refs.push(...collectParticleRefs(content.particles));
      break;
    case 'choice':
      refs.push(...collectParticleRefs(content.particles));
      break;
    case 'complexContent':
      refs.push(content.base);
      refs.push(...collectTypeRefs(content.inner));
      break;
    case 'simpleContent':
      refs.push(content.base);
      break;
    case 'group':
      refs.push(content.ref);
      break;
  }
  return refs;
}

function collectParticleRefs(particles: XsdParticle[]): string[] {
  const refs: string[] = [];
  for (const p of particles) {
    if (p.kind === 'element') {
      if (p.element.type) refs.push(p.element.type);
    } else if (p.kind === 'sequence' || p.kind === 'choice') {
      refs.push(...collectParticleRefs(p.particles));
    }
  }
  return refs;
}

export interface XsdGraphNode extends Record<string, unknown> {
  label: string;
  nodeKind: 'element' | 'complexType' | 'simpleType' | 'group';
  documentation?: string;
  meta: string;
}

export function buildGraph(schema: XsdSchema): { nodes: Node<XsdGraphNode>[]; edges: Edge[] } {
  const nodes: Node<XsdGraphNode>[] = [];
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  const knownNodes = new Set<string>();

  const addEdge = (src: string, tgt: string, label: string, color: string) => {
    const tgtName = stripPrefix(tgt);
    const tgtId =
      schema.complexTypes.find((t) => t.name === tgtName)
        ? `ct:${tgtName}`
        : schema.simpleTypes.find((t) => t.name === tgtName)
          ? `st:${tgtName}`
          : schema.groups.find((g) => g.name === tgtName)
            ? `grp:${tgtName}`
            : null;
    if (!tgtId || !knownNodes.has(tgtId)) return;
    const key = `${src}→${tgtId}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({
      id: key,
      source: src,
      target: tgtId,
      label,
      type: 'smoothstep',
      labelStyle: { fontSize: 10, fill: '#a6adc8' },
      style: { stroke: color },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    });
  };

  for (const ct of schema.complexTypes) {
    if (!ct.name) continue;
    const refs = collectTypeRefs(ct.content);
    const childCount = refs.length;
    knownNodes.add(`ct:${ct.name}`);
    nodes.push({
      id: `ct:${ct.name}`,
      type: 'xsdComplexType',
      data: {
        label: ct.name,
        nodeKind: 'complexType',
        documentation: ct.documentation,
        meta: `${ct.attributes.length} attr, ${childCount} ref`,
      },
      position: { x: 0, y: 0 },
    });
  }

  for (const st of schema.simpleTypes) {
    if (!st.name) continue;
    knownNodes.add(`st:${st.name}`);
    nodes.push({
      id: `st:${st.name}`,
      type: 'xsdSimpleType',
      data: {
        label: st.name,
        nodeKind: 'simpleType',
        documentation: st.documentation,
        meta: st.restriction ? `restriction: ${stripPrefix(st.restriction.base)}` : st.list ? 'list' : st.union ? 'union' : '',
      },
      position: { x: 0, y: 0 },
    });
  }

  for (const g of schema.groups) {
    knownNodes.add(`grp:${g.name}`);
    nodes.push({
      id: `grp:${g.name}`,
      type: 'xsdGroup',
      data: { label: g.name, nodeKind: 'group', documentation: g.documentation, meta: 'group' },
      position: { x: 0, y: 0 },
    });
  }

  for (const el of schema.elements) {
    knownNodes.add(`el:${el.name}`);
    nodes.push({
      id: `el:${el.name}`,
      type: 'xsdElement',
      data: {
        label: el.name,
        nodeKind: 'element',
        documentation: el.documentation,
        meta: el.type ? stripPrefix(el.type) : el.complexType ? '(inline)' : '(simple)',
      },
      position: { x: 0, y: 0 },
    });
  }

  for (const ct of schema.complexTypes) {
    if (!ct.name) continue;
    const refs = collectTypeRefs(ct.content);
    const unique = [...new Set(refs)].filter((r) => !isBuiltin(r));
    const isInherit = ct.content.kind === 'complexContent' || ct.content.kind === 'simpleContent';
    for (const ref of unique) {
      const label = isInherit && ref === (ct.content as { base: string }).base
        ? ct.content.kind === 'complexContent'
          ? ct.content.derivation
          : 'simpleContent'
        : 'uses';
      const color = label === 'extension' ? '#89b4fa' : label === 'restriction' ? '#f38ba8' : '#6c7086';
      addEdge(`ct:${ct.name}`, ref, label, color);
    }
  }

  for (const el of schema.elements) {
    if (el.type && !isBuiltin(el.type)) {
      addEdge(`el:${el.name}`, el.type, 'type', '#fab387');
    }
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 60 });
  nodes.forEach((n) => {
    const label = n.data.label as string;
    const w = Math.max(180, Math.min(300, label.length * 9 + 40));
    g.setNode(n.id, { width: w, height: 80 });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      const label = n.data.label as string;
      const w = Math.max(180, Math.min(300, label.length * 9 + 40));
      return { ...n, position: { x: p.x - w / 2, y: p.y - 40 } };
    }),
    edges,
  };
}
