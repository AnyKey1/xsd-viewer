export interface XsdSchema {
  targetNamespace?: string;
  elementFormDefault: string;
  attributeFormDefault: string;
  elements: XsdElement[];
  complexTypes: XsdComplexType[];
  simpleTypes: XsdSimpleType[];
  groups: XsdGroup[];
  attributeGroups: XsdAttributeGroup[];
  imports: XsdImport[];
  includes: XsdInclude[];
}

export interface XsdElement {
  name: string;
  type?: string;
  ref?: string;
  minOccurs: string;
  maxOccurs: string;
  nillable: boolean;
  abstract: boolean;
  substitutionGroup?: string;
  documentation?: string;
  complexType?: XsdComplexType;
  simpleType?: XsdSimpleType;
  default?: string;
  fixed?: string;
}

export interface XsdComplexType {
  name?: string;
  abstract: boolean;
  mixed: boolean;
  documentation?: string;
  content: XsdContent;
  attributes: XsdAttribute[];
  anyAttribute: boolean;
}

export type XsdContent =
  | { kind: 'empty' }
  | { kind: 'sequence'; particles: XsdParticle[] }
  | { kind: 'choice'; particles: XsdParticle[]; minOccurs: string; maxOccurs: string }
  | { kind: 'all'; particles: XsdParticle[] }
  | { kind: 'group'; ref: string; minOccurs: string; maxOccurs: string }
  | {
      kind: 'complexContent';
      derivation: 'extension' | 'restriction';
      base: string;
      inner: XsdContent;
      extraAttributes: XsdAttribute[];
    }
  | {
      kind: 'simpleContent';
      derivation: 'extension' | 'restriction';
      base: string;
      extraAttributes: XsdAttribute[];
    };

export type XsdParticle =
  | { kind: 'element'; element: XsdElement; minOccurs: string; maxOccurs: string }
  | { kind: 'group'; ref: string; minOccurs: string; maxOccurs: string }
  | { kind: 'sequence'; particles: XsdParticle[]; minOccurs: string; maxOccurs: string }
  | { kind: 'choice'; particles: XsdParticle[]; minOccurs: string; maxOccurs: string }
  | { kind: 'any'; namespace?: string; processContents?: string; minOccurs: string; maxOccurs: string };

export interface XsdAttribute {
  name?: string;
  ref?: string;
  type?: string;
  use: 'required' | 'optional' | 'prohibited';
  default?: string;
  fixed?: string;
  documentation?: string;
}

export interface XsdSimpleType {
  name?: string;
  documentation?: string;
  restriction?: XsdRestriction;
  list?: { itemType: string };
  union?: { memberTypes: string[] };
}

export interface XsdRestriction {
  base: string;
  enumerations?: string[];
  pattern?: string;
  minLength?: string;
  maxLength?: string;
  length?: string;
  minInclusive?: string;
  maxInclusive?: string;
  minExclusive?: string;
  maxExclusive?: string;
  totalDigits?: string;
  fractionDigits?: string;
  whiteSpace?: string;
}

export interface XsdGroup {
  name: string;
  documentation?: string;
  content: XsdContent;
}

export interface XsdAttributeGroup {
  name: string;
  documentation?: string;
  attributes: XsdAttribute[];
  anyAttribute: boolean;
}

export interface XsdImport {
  namespace?: string;
  schemaLocation?: string;
}

export interface XsdInclude {
  schemaLocation: string;
}

export type SelectedItem =
  | { kind: 'element'; name: string }
  | { kind: 'complexType'; name: string }
  | { kind: 'simpleType'; name: string }
  | { kind: 'group'; name: string }
  | { kind: 'attributeGroup'; name: string };
