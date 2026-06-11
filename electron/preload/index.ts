import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openFile: (filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),

  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('file:read', filePath),

  validateXml: (
    xmlContent: string,
    xsdContent: string,
  ): Promise<{ valid: boolean; errors: { message: string; line: number; column: number }[] }> =>
    ipcRenderer.invoke('xml:validate', xmlContent, xsdContent),
});
