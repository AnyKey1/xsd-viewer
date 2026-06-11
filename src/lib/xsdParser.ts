import type {
  XsdSchema, XsdElement, XsdComplexType, XsdContent, XsdParticle,
  XsdAttribute, XsdSimpleType, XsdRestriction, XsdGroup, XsdAttributeGroup,
} from '../types/xsd';

const XSD_NS = 'http://www.w3.org/2001/XMLSchema';

function attr(el: Element, name: string, def = ''): string {
  return el.getAttribute(name) ?? def;
}

function directChild(el: Element, localName: string): Element | undefined {
  for (const n of el.childNodes) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const c = n as Element;
      if (c.namespaceURI === XSD_NS && c.localName === localName) return c;
    }
  }
  return undefined;
}

function directChildren(el: Element, localName: string): Element[] {
  const r: Element[] = [];
  for (const n of el.childNodes) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const c = n as Element;
      if (c.namespaceURI === XSD_NS && c.localName === localName) r.push(c);
    }
  }
  return r;
}

function directChildrenAll(el: Element): Element[] {
  const r: Element[] = [];
  for (const n of el.childNodes) {
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).namespaceURI === XSD_NS) {
      r.push(n as Element);
    }
  }
  return r;
}

function documentation(el: Element): string | undefined {
  const ann = directChild(el, 'annotation');
  if (!ann) return undefined;
  const doc = directChild(ann, 'documentation');
  return doc?.textContent?.trim() || undefined;
}

function parseElement(el: Element): XsdElement {
  const ct = directChild(el, 'complexType');
  const st = directChild(el, 'simpleType');
  return {
    name: attr(el, 'name'),
    type: attr(el, 'type') || undefined,
    ref: attr(el, 'ref') || undefined,
    minOccurs: attr(el, 'minOccurs', '1'),
    maxOccurs: attr(el, 'maxOccurs', '1'),
    nillable: attr(el, 'nillable') === 'true',
    abstract: attr(el, 'abstract') === 'true',
    substitutionGroup: attr(el, 'substitutionGroup') || undefined,
    default: attr(el, 'default') || undefined,
    fixed: attr(el, 'fixed') || undefined,
    documentation: documentation(el),
    complexType: ct ? parseComplexType(ct) : undefined,
    simpleType: st ? parseSimpleType(st) : undefined,
  };
}

function parseContentModel(el: Element): XsdContent {
  const seq = directChild(el, 'sequence');
  if (seq) return { kind: 'sequence', particles: parseParticles(seq) };

  const choice = directChild(el, 'choice');
  if (choice) return {
    kind: 'choice',
    particles: parseParticles(choice),
    minOccurs: attr(choice, 'minOccurs', '1'),
    maxOccurs: attr(choice, 'maxOccurs', '1'),
  };

  const all = directChild(el, 'all');
  if (all) return { kind: 'all', particles: parseParticles(all) };

  const grp = directChild(el, 'group');
  if (grp) return {
    kind: 'group',
    ref: attr(grp, 'ref'),
    minOccurs: attr(grp, 'minOccurs', '1'),
    maxOccurs: attr(grp, 'maxOccurs', '1'),
  };

  return { kind: 'empty' };
}

function parseParticles(el: Element): XsdParticle[] {
  const result: XsdParticle[] = [];
  for (const c of directChildrenAll(el)) {
    const min = attr(c, 'minOccurs', '1');
    const max = attr(c, 'maxOccurs', '1');
    switch (c.localName) {
      case 'element':
        result.push({ kind: 'element', element: parseElement(c), minOccurs: min, maxOccurs: max });
        break;
      case 'group':
        result.push({ kind: 'group', ref: attr(c, 'ref'), minOccurs: min, maxOccurs: max });
        break;
      case 'sequence':
        result.push({ kind: 'sequence', particles: parseParticles(c), minOccurs: min, maxOccurs: max });
        break;
      case 'choice':
        result.push({ kind: 'choice', particles: parseParticles(c), minOccurs: min, maxOccurs: max });
        break;
      case 'any':
        result.push({
          kind: 'any',
          namespace: attr(c, 'namespace') || undefined,
          processContents: attr(c, 'processContents') || undefined,
          minOccurs: min,
          maxOccurs: max,
        });
        break;
    }
  }
  return result;
}

function parseAttributes(el: Element): XsdAttribute[] {
  const result: XsdAttribute[] = [];
  for (const c of directChildrenAll(el)) {
    if (c.localName === 'attribute') {
      result.push({
        name: attr(c, 'name') || undefined,
        ref: attr(c, 'ref') || undefined,
        type: attr(c, 'type') || undefined,
        use: (attr(c, 'use', 'optional') as XsdAttribute['use']),
        default: attr(c, 'default') || undefined,
        fixed: attr(c, 'fixed') || undefined,
        documentation: documentation(c),
      });
    } else if (c.localName === 'attributeGroup') {
      result.push({
        ref: attr(c, 'ref'),
        use: 'optional',
      });
    }
  }
  return result;
}

function parseComplexType(el: Element): XsdComplexType {
  const ccEl = directChild(el, 'complexContent');
  if (ccEl) {
    const extEl = directChild(ccEl, 'extension');
    const rstEl = directChild(ccEl, 'restriction');
    const derivEl = extEl ?? rstEl!;
    return {
      name: attr(el, 'name') || undefined,
      abstract: attr(el, 'abstract') === 'true',
      mixed: attr(el, 'mixed') === 'true',
      documentation: documentation(el),
      content: {
        kind: 'complexContent',
        derivation: extEl ? 'extension' : 'restriction',
        base: attr(derivEl, 'base'),
        inner: parseContentModel(derivEl),
        extraAttributes: parseAttributes(derivEl),
      },
      attributes: parseAttributes(el),
      anyAttribute: !!directChild(el, 'anyAttribute'),
    };
  }

  const scEl = directChild(el, 'simpleContent');
  if (scEl) {
    const extEl = directChild(scEl, 'extension');
    const rstEl = directChild(scEl, 'restriction');
    const derivEl = extEl ?? rstEl!;
    return {
      name: attr(el, 'name') || undefined,
      abstract: attr(el, 'abstract') === 'true',
      mixed: false,
      documentation: documentation(el),
      content: {
        kind: 'simpleContent',
        derivation: extEl ? 'extension' : 'restriction',
        base: attr(derivEl, 'base'),
        extraAttributes: parseAttributes(derivEl),
      },
      attributes: parseAttributes(el),
      anyAttribute: !!directChild(el, 'anyAttribute'),
    };
  }

  return {
    name: attr(el, 'name') || undefined,
    abstract: attr(el, 'abstract') === 'true',
    mixed: attr(el, 'mixed') === 'true',
    documentation: documentation(el),
    content: parseContentModel(el),
    attributes: parseAttributes(el),
    anyAttribute: !!directChild(el, 'anyAttribute'),
  };
}

function parseSimpleType(el: Element): XsdSimpleType {
  const rst = directChild(el, 'restriction');
  if (rst) {
    const res: XsdRestriction = { base: attr(rst, 'base') };
    const enums = directChildren(rst, 'enumeration').map((e) => attr(e, 'value'));
    if (enums.length) res.enumerations = enums;
    const facets: (keyof XsdRestriction)[] = [
      'pattern', 'minLength', 'maxLength', 'length',
      'minInclusive', 'maxInclusive', 'minExclusive', 'maxExclusive',
      'totalDigits', 'fractionDigits', 'whiteSpace',
    ];
    for (const f of facets) {
      const facetEl = directChild(rst, f);
      if (facetEl) (res as Record<string, string>)[f] = attr(facetEl, 'value');
    }
    return { name: attr(el, 'name') || undefined, documentation: documentation(el), restriction: res };
  }

  const lst = directChild(el, 'list');
  if (lst) {
    return {
      name: attr(el, 'name') || undefined,
      documentation: documentation(el),
      list: { itemType: attr(lst, 'itemType') },
    };
  }

  const union = directChild(el, 'union');
  if (union) {
    const memberTypes = attr(union, 'memberTypes').split(/\s+/).filter(Boolean);
    return {
      name: attr(el, 'name') || undefined,
      documentation: documentation(el),
      union: { memberTypes },
    };
  }

  return { name: attr(el, 'name') || undefined, documentation: documentation(el) };
}

export function parseXsd(content: string): XsdSchema {
  const doc = new DOMParser().parseFromString(content, 'application/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error('XML parse error: ' + parseErr.textContent?.slice(0, 200));

  const schema = doc.documentElement;
  const result: XsdSchema = {
    targetNamespace: schema.getAttribute('targetNamespace') || undefined,
    elementFormDefault: attr(schema, 'elementFormDefault', 'unqualified'),
    attributeFormDefault: attr(schema, 'attributeFormDefault', 'unqualified'),
    elements: [],
    complexTypes: [],
    simpleTypes: [],
    groups: [],
    attributeGroups: [],
    imports: [],
    includes: [],
  };

  for (const child of directChildrenAll(schema)) {
    switch (child.localName) {
      case 'element':
        result.elements.push(parseElement(child));
        break;
      case 'complexType':
        result.complexTypes.push(parseComplexType(child));
        break;
      case 'simpleType':
        result.simpleTypes.push(parseSimpleType(child));
        break;
      case 'group': {
        const grpContent = parseContentModel(child);
        result.groups.push({
          name: attr(child, 'name'),
          documentation: documentation(child),
          content: grpContent,
        });
        break;
      }
      case 'attributeGroup':
        result.attributeGroups.push({
          name: attr(child, 'name'),
          documentation: documentation(child),
          attributes: parseAttributes(child),
          anyAttribute: !!directChild(child, 'anyAttribute'),
        });
        break;
      case 'import':
        result.imports.push({
          namespace: attr(child, 'namespace') || undefined,
          schemaLocation: attr(child, 'schemaLocation') || undefined,
        });
        break;
      case 'include':
        result.includes.push({ schemaLocation: attr(child, 'schemaLocation') });
        break;
    }
  }

  return result;
}
