import { useState, useMemo } from 'react';
import type { XsdSchema, SelectedItem } from '../types/xsd';

interface Props {
  schema: XsdSchema;
  filePath: string;
  selected: SelectedItem | null;
  search: string;
  onSelect: (item: SelectedItem) => void;
}

type SectionKey = 'elements' | 'complexTypes' | 'simpleTypes' | 'groups' | 'attributeGroups' | 'imports';

function occLabel(min: string, max: string): string {
  if (min === '1' && max === '1') return '';
  if (min === '0' && max === '1') return '?';
  if (min === '0' && max === 'unbounded') return '*';
  if (min === '1' && max === 'unbounded') return '+';
  return `[${min}..${max}]`;
}

export default function XsdTree({ schema, filePath, selected, search, onSelect }: Props) {
  const [open, setOpen] = useState<Set<SectionKey>>(
    new Set(['elements', 'complexTypes', 'simpleTypes']),
  );

  const q = search.toLowerCase();

  const toggle = (k: SectionKey) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

  const isMatch = (name: string) => !q || name.toLowerCase().includes(q);

  const sections: { key: SectionKey; label: string; count: number }[] = [
    { key: 'elements', label: 'Elements', count: schema.elements.filter((e) => isMatch(e.name)).length },
    { key: 'complexTypes', label: 'Complex Types', count: schema.complexTypes.filter((t) => isMatch(t.name ?? '')).length },
    { key: 'simpleTypes', label: 'Simple Types', count: schema.simpleTypes.filter((t) => isMatch(t.name ?? '')).length },
    { key: 'groups', label: 'Groups', count: schema.groups.filter((g) => isMatch(g.name)).length },
    { key: 'attributeGroups', label: 'Attr Groups', count: schema.attributeGroups.filter((g) => isMatch(g.name)).length },
    { key: 'imports', label: 'Imports', count: schema.imports.length + schema.includes.length },
  ];

  return (
    <div className="tree">
      <div className="tree-header" title={filePath}>
        <span className="icon">📄</span>
        <span className="tree-filename">{fileName}</span>
      </div>
      {schema.targetNamespace && (
        <div className="tree-ns" title={schema.targetNamespace}>
          ns: {schema.targetNamespace}
        </div>
      )}

      {sections.map(({ key, label, count }) => {
        if (count === 0 && key !== 'imports') return null;
        const isOpen = open.has(key);
        return (
          <div key={key}>
            <div className="tree-section" onClick={() => toggle(key)}>
              <span className="tree-arrow">{isOpen ? '▾' : '▸'}</span>
              <span>{label}</span>
              <span className="tree-badge">{count}</span>
            </div>

            {isOpen && key === 'elements' &&
              schema.elements
                .filter((e) => isMatch(e.name))
                .map((el) => (
                  <div
                    key={el.name}
                    className={`tree-item tree-item--element ${selected?.kind === 'element' && selected.name === el.name ? 'tree-item--active' : ''}`}
                    onClick={() => onSelect({ kind: 'element', name: el.name })}
                    title={el.documentation}
                  >
                    <span className="tree-item-icon">◈</span>
                    <span className="tree-item-name">{el.name}</span>
                    {el.type && <span className="tree-item-type">{el.type.split(':').pop()}</span>}
                  </div>
                ))}

            {isOpen && key === 'complexTypes' &&
              schema.complexTypes
                .filter((t) => isMatch(t.name ?? ''))
                .map((ct) => (
                  <div
                    key={ct.name}
                    className={`tree-item tree-item--complex ${selected?.kind === 'complexType' && selected.name === ct.name ? 'tree-item--active' : ''}`}
                    onClick={() => onSelect({ kind: 'complexType', name: ct.name! })}
                    title={ct.documentation}
                  >
                    <span className="tree-item-icon">⬡</span>
                    <span className="tree-item-name">{ct.name}</span>
                    {ct.abstract && <span className="tree-item-tag">abstract</span>}
                  </div>
                ))}

            {isOpen && key === 'simpleTypes' &&
              schema.simpleTypes
                .filter((t) => isMatch(t.name ?? ''))
                .map((st) => (
                  <div
                    key={st.name}
                    className={`tree-item tree-item--simple ${selected?.kind === 'simpleType' && selected.name === st.name ? 'tree-item--active' : ''}`}
                    onClick={() => onSelect({ kind: 'simpleType', name: st.name! })}
                    title={st.documentation}
                  >
                    <span className="tree-item-icon">◇</span>
                    <span className="tree-item-name">{st.name}</span>
                    {st.restriction && (
                      <span className="tree-item-type">{st.restriction.base.split(':').pop()}</span>
                    )}
                  </div>
                ))}

            {isOpen && key === 'groups' &&
              schema.groups
                .filter((g) => isMatch(g.name))
                .map((grp) => (
                  <div
                    key={grp.name}
                    className={`tree-item tree-item--group ${selected?.kind === 'group' && selected.name === grp.name ? 'tree-item--active' : ''}`}
                    onClick={() => onSelect({ kind: 'group', name: grp.name })}
                  >
                    <span className="tree-item-icon">⬢</span>
                    <span className="tree-item-name">{grp.name}</span>
                  </div>
                ))}

            {isOpen && key === 'attributeGroups' &&
              schema.attributeGroups
                .filter((g) => isMatch(g.name))
                .map((ag) => (
                  <div
                    key={ag.name}
                    className={`tree-item tree-item--attrgroup ${selected?.kind === 'attributeGroup' && selected.name === ag.name ? 'tree-item--active' : ''}`}
                    onClick={() => onSelect({ kind: 'attributeGroup', name: ag.name })}
                  >
                    <span className="tree-item-icon">@</span>
                    <span className="tree-item-name">{ag.name}</span>
                  </div>
                ))}

            {isOpen && key === 'imports' && (
              <>
                {schema.imports.map((imp, i) => (
                  <div key={`import-${i}`} className="tree-item tree-item--import" title={imp.namespace}>
                    <span className="tree-item-icon">↗</span>
                    <span className="tree-item-name">{imp.schemaLocation ?? imp.namespace ?? '(no location)'}</span>
                  </div>
                ))}
                {schema.includes.map((inc, i) => (
                  <div key={`include-${i}`} className="tree-item tree-item--import">
                    <span className="tree-item-icon">↪</span>
                    <span className="tree-item-name">{inc.schemaLocation}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { occLabel };
