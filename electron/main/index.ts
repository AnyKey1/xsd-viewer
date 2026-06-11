import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { readFile, writeFile, unlink } from 'fs/promises';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'XSD Viewer',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle(
  'dialog:openFile',
  async (_e, filters: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  },
);

ipcMain.handle('file:read', async (_e, filePath: string) => {
  const buf = await readFile(filePath);

  // Detect encoding from XML declaration (e.g. encoding="windows-1251")
  const peek = buf.slice(0, 512).toString('ascii');
  const m = peek.match(/encoding\s*=\s*["']([^"']+)["']/i);
  const enc = m?.[1]?.toLowerCase().replace(/[-_]/g, '') ?? 'utf8';

  let content: string;
  if (enc === 'windows1251' || enc === 'cp1251' || enc === 'win1251' || enc === '1251') {
    content = new TextDecoder('windows-1251').decode(buf);
  } else if (enc === 'windows1252' || enc === 'cp1252') {
    content = new TextDecoder('windows-1252').decode(buf);
  } else {
    content = buf.toString('utf-8');
  }

  // Replace original encoding declaration so DOMParser doesn't try to re-decode
  content = content.replace(
    /(<\?xml[^?]*?)encoding\s*=\s*["'][^"']*["']/i,
    '$1encoding="UTF-8"',
  );

  return content;
});

interface ValidationError {
  message: string;
  line: number;
  column: number;
}

function parseXmllintOutput(output: string): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^[^:]+:(\d+)(?::(\d+))?:\s*(.+)$/);
    if (m) {
      errors.push({ line: +m[1], column: m[2] ? +m[2] : 0, message: m[3] });
    } else if (!line.includes(' validates') && !line.includes(' fails ')) {
      errors.push({ line: 0, column: 0, message: line });
    }
  }
  return errors;
}

ipcMain.handle('xml:validate', async (_e, xmlContent: string, xsdContent: string) => {
  const id = randomBytes(8).toString('hex');
  const tmpXml = join(tmpdir(), `xsdv_${id}.xml`);
  const tmpXsd = join(tmpdir(), `xsdv_${id}.xsd`);

  try {
    await Promise.all([
      writeFile(tmpXml, xmlContent, 'utf-8'),
      writeFile(tmpXsd, xsdContent, 'utf-8'),
    ]);

    return await new Promise((resolve) => {
      const proc = spawn('xmllint', ['--schema', tmpXsd, '--noout', tmpXml]);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => resolve({ valid: code === 0, errors: parseXmllintOutput(stderr) }));
      proc.on('error', () =>
        resolve({
          valid: false,
          errors: [
            {
              line: 0,
              column: 0,
              message:
                'xmllint не найден. Установите: macOS — xcode-select --install, Linux — apt install libxml2-utils',
            },
          ],
        }),
      );
    });
  } finally {
    unlink(tmpXml).catch(() => {});
    unlink(tmpXsd).catch(() => {});
  }
});
