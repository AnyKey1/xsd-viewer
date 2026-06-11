/// <reference types="vite/client" />

interface ValidationError {
  message: string;
  line: number;
  column: number;
}

interface Window {
  api: {
    openFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
    readFile: (filePath: string) => Promise<string>;
    validateXml: (
      xmlContent: string,
      xsdContent: string,
    ) => Promise<{ valid: boolean; errors: ValidationError[] }>;
  };
}
