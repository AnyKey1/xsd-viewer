import { useEffect, useRef, useMemo, useCallback } from 'react';
import type { XsdSchema, SelectedItem } from '../types/xsd';

interface Props {
  content: string;
  schema: XsdSchema | null;
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem) => void;
}

// XSD-defining tags whose name="" attribute creates a navigation anchor
const DEFINING_TAGS = new Set(['element', 'complexType', 'simpleType', 'group', 'attributeGroup']);

// Attributes whose values are type/element references (single qname)
const REF_ATTRS = new Set(['type', 'base', 'ref', 'substitutionGroup', 'itemType']);

function stripPrefix(qname: string): string {
  const i = qname.lastIndexOf(':');
  return i >= 0 ? qname.slice(i + 1) : qname;
}

function resolveRef(name: string, schema: XsdSchema | null): SelectedItem | null {
  if (!schema) return null;
  const n = stripPrefix(name);
  if (schema.complexTypes.some((t) => t.name === n)) return { kind: 'complexType', name: n };
  if (schema.simpleTypes.some((t) => t.name === n)) return { kind: 'simpleType', name: n };
  if (schema.elements.some((e) => e.name === n)) return { kind: 'element', name: n };
  if (schema.groups.some((g) => g.name === n)) return { kind: 'group', name: n };
  if (schema.attributeGroups.some((g) => g.name === n)) return { kind: 'attributeGroup', name: n };
  return null;
}

interface Seg {
  text: string;
  cls: string;
  anchorId?: string;
  resolvedItem?: SelectedItem;
}

interface LineData {
  number: number;
  segments: Seg[];
  anchorId?: string;
}

function parseSource(content: string, schema: XsdSchema | null): LineData[] {
  const lines = content.split('\n');
  const result: LineData[] = [];

  let inComment = false;
  let inPI = false;
  let inTag = false;
  let currentTagLocal = '';
  let isDefiningTag = false;
  let lastAttrName = '';

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const segs: Seg[] = [];
    let lineAnchorId: string | undefined;
    let i = 0;

    while (i < line.length) {
      // ── Inside a comment ──────────────────────────────────────────────
      if (inComment) {
        const end = line.indexOf('-->', i);
        if (end >= 0) {
          segs.push({ text: line.slice(i, end + 3), cls: 'sx-comment' });
          i = end + 3;
          inComment = false;
        } else {
          segs.push({ text: line.slice(i), cls: 'sx-comment' });
          i = line.length;
        }
        continue;
      }

      // ── Inside a processing instruction ───────────────────────────────
      if (inPI) {
        const end = line.indexOf('?>', i);
        if (end >= 0) {
          segs.push({ text: line.slice(i, end + 2), cls: 'sx-pi' });
          i = end + 2;
          inPI = false;
        } else {
          segs.push({ text: line.slice(i), cls: 'sx-pi' });
          i = line.length;
        }
        continue;
      }

      // ── Start of comment ──────────────────────────────────────────────
      if (line.startsWith('<!--', i)) {
        const end = line.indexOf('-->', i + 4);
        if (end >= 0) {
          segs.push({ text: line.slice(i, end + 3), cls: 'sx-comment' });
          i = end + 3;
        } else {
          segs.push({ text: line.slice(i), cls: 'sx-comment' });
          i = line.length;
          inComment = true;
        }
        continue;
      }

      // ── Start of PI ───────────────────────────────────────────────────
      if (line.startsWith('<?', i)) {
        const end = line.indexOf('?>', i + 2);
        if (end >= 0) {
          segs.push({ text: line.slice(i, end + 2), cls: 'sx-pi' });
          i = end + 2;
        } else {
          segs.push({ text: line.slice(i), cls: 'sx-pi' });
          i = line.length;
          inPI = true;
        }
        continue;
      }

      // ── Outside a tag ─────────────────────────────────────────────────
      if (!inTag) {
        if (line[i] === '<') {
          inTag = true;
          segs.push({ text: '<', cls: 'sx-bracket' });
          i++;

          // Closing slash
          if (i < line.length && line[i] === '/') {
            segs.push({ text: '/', cls: 'sx-bracket' });
            i++;
          }

          // Tag name
          const ns = i;
          while (i < line.length && /[\w:.-]/.test(line[i])) i++;
          if (i > ns) {
            const tag = line.slice(ns, i);
            const local = tag.includes(':') ? tag.split(':').pop()! : tag;
            currentTagLocal = local;
            isDefiningTag = DEFINING_TAGS.has(local);
            segs.push({ text: tag, cls: 'sx-tagname' });
          }
          lastAttrName = '';
        } else {
          // Text content between tags
          const ts = i;
          while (i < line.length && line[i] !== '<') i++;
          const txt = line.slice(ts, i);
          if (txt) segs.push({ text: txt, cls: 'sx-text' });
        }
        continue;
      }

      // ── Inside a tag ──────────────────────────────────────────────────

      // Whitespace
      if (/\s/.test(line[i])) {
        const ws = i;
        while (i < line.length && /\s/.test(line[i])) i++;
        segs.push({ text: line.slice(ws, i), cls: 'sx-ws' });
        continue;
      }

      // Self-close
      if (line[i] === '/' && line[i + 1] === '>') {
        segs.push({ text: '/>', cls: 'sx-bracket' });
        i += 2;
        inTag = false;
        lastAttrName = '';
        currentTagLocal = '';
        isDefiningTag = false;
        continue;
      }

      // Close bracket
      if (line[i] === '>') {
        segs.push({ text: '>', cls: 'sx-bracket' });
        i++;
        inTag = false;
        lastAttrName = '';
        continue;
      }

      // Equals
      if (line[i] === '=') {
        segs.push({ text: '=', cls: 'sx-bracket' });
        i++;
        continue;
      }

      // Quoted attribute value
      if (line[i] === '"' || line[i] === "'") {
        const q = line[i];
        i++;
        const vs = i;
        while (i < line.length && line[i] !== q) i++;
        const val = line.slice(vs, i);
        if (i < line.length) i++; // closing quote
        const full = q + val + q;

        if (isDefiningTag && lastAttrName === 'name' && val) {
          const anchorId = `def-${val}`;
          lineAnchorId = anchorId;
          segs.push({ text: full, cls: 'sx-attrval sx-defname', anchorId });
        } else if (REF_ATTRS.has(lastAttrName) && val) {
          const resolved = resolveRef(val, schema);
          if (resolved) {
            segs.push({ text: full, cls: 'sx-attrval sx-ref', resolvedItem: resolved });
          } else {
            segs.push({ text: full, cls: 'sx-attrval' });
          }
        } else if (lastAttrName === 'memberTypes' && val) {
          // Space-separated list — link each token
          const parts = val.split(/\s+/);
          segs.push({ text: q, cls: 'sx-bracket' });
          parts.forEach((part, pi) => {
            if (!part) return;
            const resolved = resolveRef(part, schema);
            if (resolved) {
              segs.push({ text: part, cls: 'sx-ref', resolvedItem: resolved });
            } else {
              segs.push({ text: part, cls: 'sx-attrval' });
            }
            if (pi < parts.length - 1) segs.push({ text: ' ', cls: 'sx-ws' });
          });
          segs.push({ text: q, cls: 'sx-bracket' });
        } else {
          segs.push({ text: full, cls: 'sx-attrval' });
        }
        continue;
      }

      // Attribute name
      const as = i;
      while (i < line.length && /[\w:.-]/.test(line[i])) i++;
      if (i > as) {
        const attrRaw = line.slice(as, i);
        const local = attrRaw.includes(':') ? attrRaw.split(':').pop()! : attrRaw;
        lastAttrName = local;
        segs.push({ text: attrRaw, cls: 'sx-attrname' });
        continue;
      }

      // Fallback
      segs.push({ text: line[i], cls: 'sx-other' });
      i++;
    }

    result.push({ number: lineIdx + 1, segments: segs, anchorId: lineAnchorId });
  }

  return result;
}

export default function XsdSource({ content, schema, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => parseSource(content, schema), [content, schema]);

  // Scroll to selected item when it changes
  useEffect(() => {
    if (!selected || !containerRef.current) return;
    const anchorId = `def-${selected.name}`;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-anchor="${anchorId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selected]);

  const handleRefClick = useCallback(
    (item: SelectedItem) => {
      onSelect(item);
      // Scroll to the definition line
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const el = containerRef.current.querySelector<HTMLElement>(
          `[data-anchor="def-${item.name}"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    [onSelect],
  );

  return (
    <div className="source-view" ref={containerRef}>
      <pre className="source-pre">
        <code>
          {lines.map((line) => (
            <div
              key={line.number}
              className={`source-line${line.anchorId ? ' source-line--def' : ''}`}
              data-anchor={line.anchorId}
            >
              <span className="source-linenum">{line.number}</span>
              <span className="source-linetext">
                {line.segments.map((seg, si) =>
                  seg.resolvedItem ? (
                    <span
                      key={si}
                      className={seg.cls}
                      onClick={() => handleRefClick(seg.resolvedItem!)}
                      title={`→ ${seg.resolvedItem.kind}: ${seg.resolvedItem.name}`}
                    >
                      {seg.text}
                    </span>
                  ) : (
                    <span key={si} className={seg.cls}>
                      {seg.text}
                    </span>
                  ),
                )}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
