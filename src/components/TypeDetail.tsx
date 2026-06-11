import type { XsdSchema, XsdContent, XsdParticle, XsdAttribute, SelectedItem } from '../types/xsd';

interface Props {
  schema: XsdSchema;
  selected: SelectedItem;
}

function occSpan(min: string, max: string) {
  const label = min === '1' && max === '1' ? '' : ` [${min}..${max}]`;
  const cls = min === '0' ? 'occ-optional' : 'occ-required';
  return label ? <span className={cls}>{label}</span> : null;
}

function AttrRow({ a }: { a: XsdAttribute }) {
  const name = a.ref ? `@ref:${a.ref}` : `@${a.name}`;
  return (
    <div className={`detail-attr ${a.use === 'required' ? 'detail-attr--required' : ''}`}>
      <span className="detail-attr-name">{name}</span>
      {a.type && <span className="detail-attr-type">{a.type.split(':').pop()}</span>}
      <span className={`detail-attr-use detail-attr-use--${a.use}`}>{a.use}</span>
      {a.documentation && <span className="detail-attr-doc">{a.documentation}</span>}
    </div>
  );
}

function ContentView({ content }: { content: XsdContent }) {
  switch (content.kind) {
    case 'empty':
      return <span className="detail-empty">empty</span>;
    case 'sequence':
      return (
        <div className="detail-content-group">
          <span className="detail-compositor">sequence</span>
          <div className="detail-particles">
            {content.particles.map((p, i) => <ParticleView key={i} p={p} />)}
          </div>
        </div>
      );
    case 'choice':
      return (
        <div className="detail-content-group">
          <span className="detail-compositor">choice</span>
          {occSpan(content.minOccurs, content.maxOccurs)}
          <div className="detail-particles">
            {content.particles.map((p, i) => <ParticleView key={i} p={p} />)}
          </div>
        </div>
      );
    case 'all':
      return (
        <div className="detail-content-group">
          <span className="detail-compositor">all</span>
          <div className="detail-particles">
            {content.particles.map((p, i) => <ParticleView key={i} p={p} />)}
          </div>
        </div>
      );
    case 'complexContent':
      return (
        <div className="detail-content-group">
          <span className={`detail-compositor detail-compositor--${content.derivation}`}>
            {content.derivation} of{' '}
          </span>
          <span className="detail-typeref">{content.base}</span>
          {content.inner.kind !== 'empty' && <ContentView content={content.inner} />}
        </div>
      );
    case 'simpleContent':
      return (
        <div className="detail-content-group">
          <span className={`detail-compositor detail-compositor--${content.derivation}`}>
            {content.derivation} of{' '}
          </span>
          <span className="detail-typeref">{content.base}</span>
        </div>
      );
    case 'group':
      return <div className="detail-groupref">group ref: <span className="detail-typeref">{content.ref}</span></div>;
  }
}

function ParticleView({ p }: { p: XsdParticle }) {
  switch (p.kind) {
    case 'element':
      return (
        <div className="detail-particle detail-particle--element">
          <span className="pi-name">{p.element.ref ? `ref:${p.element.ref}` : p.element.name}</span>
          {p.element.type && <span className="pi-type">{p.element.type.split(':').pop()}</span>}
          {occSpan(p.minOccurs, p.maxOccurs)}
          {p.element.documentation && <span className="pi-doc">{p.element.documentation}</span>}
        </div>
      );
    case 'group':
      return (
        <div className="detail-particle detail-particle--group">
          <span className="pi-name">group: {p.ref}</span>
          {occSpan(p.minOccurs, p.maxOccurs)}
        </div>
      );
    case 'sequence':
      return (
        <div className="detail-particle detail-particle--seq">
          <span className="detail-compositor">sequence</span>
          {occSpan(p.minOccurs, p.maxOccurs)}
          <div className="detail-particles">{p.particles.map((c, i) => <ParticleView key={i} p={c} />)}</div>
        </div>
      );
    case 'choice':
      return (
        <div className="detail-particle detail-particle--choice">
          <span className="detail-compositor">choice</span>
          {occSpan(p.minOccurs, p.maxOccurs)}
          <div className="detail-particles">{p.particles.map((c, i) => <ParticleView key={i} p={c} />)}</div>
        </div>
      );
    case 'any':
      return (
        <div className="detail-particle detail-particle--any">
          <span className="pi-name">any</span>
          {p.namespace && <span className="pi-type">{p.namespace}</span>}
          {occSpan(p.minOccurs, p.maxOccurs)}
        </div>
      );
  }
}

export default function TypeDetail({ schema, selected }: Props) {
  if (selected.kind === 'element') {
    const el = schema.elements.find((e) => e.name === selected.name);
    if (!el) return <div className="detail-empty-state">Element not found</div>;
    return (
      <div className="detail">
        <div className="detail-title">
          <span className="detail-kind-badge detail-kind-badge--element">element</span>
          <span className="detail-name">{el.name}</span>
        </div>
        {el.documentation && <div className="detail-doc">{el.documentation}</div>}
        {el.type && <div className="detail-row"><span className="detail-label">Type</span><span className="detail-typeref">{el.type}</span></div>}
        {el.substitutionGroup && <div className="detail-row"><span className="detail-label">SubstGroup</span><span>{el.substitutionGroup}</span></div>}
        {el.nillable && <div className="detail-row"><span className="detail-tag">nillable</span></div>}
        {el.abstract && <div className="detail-row"><span className="detail-tag">abstract</span></div>}
        {el.default && <div className="detail-row"><span className="detail-label">Default</span><code>{el.default}</code></div>}
        {el.complexType && (
          <>
            <div className="detail-section">Inline Complex Type</div>
            <ContentView content={el.complexType.content} />
            {el.complexType.attributes.length > 0 && (
              <><div className="detail-section">Attributes</div>
              {el.complexType.attributes.map((a, i) => <AttrRow key={i} a={a} />)}</>
            )}
          </>
        )}
      </div>
    );
  }

  if (selected.kind === 'complexType') {
    const ct = schema.complexTypes.find((t) => t.name === selected.name);
    if (!ct) return <div className="detail-empty-state">Type not found</div>;
    return (
      <div className="detail">
        <div className="detail-title">
          <span className="detail-kind-badge detail-kind-badge--complex">complexType</span>
          <span className="detail-name">{ct.name}</span>
          {ct.abstract && <span className="detail-tag">abstract</span>}
          {ct.mixed && <span className="detail-tag">mixed</span>}
        </div>
        {ct.documentation && <div className="detail-doc">{ct.documentation}</div>}
        <div className="detail-section">Content</div>
        <ContentView content={ct.content} />
        {ct.attributes.length > 0 && (
          <><div className="detail-section">Attributes</div>
          {ct.attributes.map((a, i) => <AttrRow key={i} a={a} />)}</>
        )}
        {ct.anyAttribute && <div className="detail-row"><span className="detail-tag">anyAttribute</span></div>}
      </div>
    );
  }

  if (selected.kind === 'simpleType') {
    const st = schema.simpleTypes.find((t) => t.name === selected.name);
    if (!st) return <div className="detail-empty-state">Type not found</div>;
    const rst = st.restriction;
    return (
      <div className="detail">
        <div className="detail-title">
          <span className="detail-kind-badge detail-kind-badge--simple">simpleType</span>
          <span className="detail-name">{st.name}</span>
        </div>
        {st.documentation && <div className="detail-doc">{st.documentation}</div>}
        {rst && (
          <>
            <div className="detail-section">Restriction</div>
            <div className="detail-row"><span className="detail-label">Base</span><span className="detail-typeref">{rst.base}</span></div>
            {rst.pattern && <div className="detail-row"><span className="detail-label">Pattern</span><code>{rst.pattern}</code></div>}
            {rst.minLength && <div className="detail-row"><span className="detail-label">minLength</span><code>{rst.minLength}</code></div>}
            {rst.maxLength && <div className="detail-row"><span className="detail-label">maxLength</span><code>{rst.maxLength}</code></div>}
            {rst.length && <div className="detail-row"><span className="detail-label">length</span><code>{rst.length}</code></div>}
            {rst.minInclusive && <div className="detail-row"><span className="detail-label">minInclusive</span><code>{rst.minInclusive}</code></div>}
            {rst.maxInclusive && <div className="detail-row"><span className="detail-label">maxInclusive</span><code>{rst.maxInclusive}</code></div>}
            {rst.totalDigits && <div className="detail-row"><span className="detail-label">totalDigits</span><code>{rst.totalDigits}</code></div>}
            {rst.fractionDigits && <div className="detail-row"><span className="detail-label">fractionDigits</span><code>{rst.fractionDigits}</code></div>}
            {rst.enumerations && rst.enumerations.length > 0 && (
              <>
                <div className="detail-section">Enumeration ({rst.enumerations.length})</div>
                <div className="detail-enums">
                  {rst.enumerations.map((v) => <span key={v} className="detail-enum-val">{v}</span>)}
                </div>
              </>
            )}
          </>
        )}
        {st.list && <div className="detail-row"><span className="detail-label">List of</span><span className="detail-typeref">{st.list.itemType}</span></div>}
        {st.union && (
          <div className="detail-row">
            <span className="detail-label">Union</span>
            {st.union.memberTypes.map((t) => <span key={t} className="detail-typeref">{t} </span>)}
          </div>
        )}
      </div>
    );
  }

  if (selected.kind === 'group') {
    const grp = schema.groups.find((g) => g.name === selected.name);
    if (!grp) return <div className="detail-empty-state">Group not found</div>;
    return (
      <div className="detail">
        <div className="detail-title">
          <span className="detail-kind-badge detail-kind-badge--group">group</span>
          <span className="detail-name">{grp.name}</span>
        </div>
        {grp.documentation && <div className="detail-doc">{grp.documentation}</div>}
        <div className="detail-section">Content</div>
        <ContentView content={grp.content} />
      </div>
    );
  }

  return null;
}
