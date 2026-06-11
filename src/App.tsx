import { useState, useCallback, useRef } from 'react';
import { parseXsd } from './lib/xsdParser';
import type { XsdSchema, SelectedItem } from './types/xsd';
import XsdTree from './components/XsdTree';
import TypeDetail from './components/TypeDetail';
import XsdGraph from './components/XsdGraph';
import XmlValidator from './components/XmlValidator';
import XsdSource from './components/XsdSource';

type Tab = 'graph' | 'detail' | 'validate' | 'source';

export default function App() {
  const [schema, setSchema] = useState<XsdSchema | null>(null);
  const [xsdContent, setXsdContent] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [tab, setTab] = useState<Tab>('graph');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const dragging = useRef(false);

  const openXsd = async () => {
    const path = await window.api.openFile([{ name: 'XSD Schema', extensions: ['xsd', 'xml'] }]);
    if (!path) return;
    try {
      const content = await window.api.readFile(path);
      const parsed = parseXsd(content);
      setSchema(parsed);
      setXsdContent(content);
      setFilePath(path);
      setSelected(null);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const onSelect = useCallback((item: SelectedItem) => {
    setSelected(item);
    setTab('detail');
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setSidebarWidth(Math.max(180, Math.min(520, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="app">
      <header className="toolbar">
        <span className="toolbar-brand">XSD Viewer</span>
        <button className="btn btn--primary" onClick={openXsd}>Открыть XSD</button>
        {schema && (
          <input
            className="search-input"
            placeholder="Поиск по схеме…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        {schema && (
          <div className="toolbar-stats">
            <span>{schema.elements.length} el</span>
            <span>{schema.complexTypes.length} ct</span>
            <span>{schema.simpleTypes.length} st</span>
          </div>
        )}
      </header>

      {error && (
        <div className="error-banner">
          <strong>Ошибка парсинга:</strong> {error}
          <button className="error-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {!schema ? (
        <div className="welcome">
          <div className="welcome-box">
            <div className="welcome-icon">📋</div>
            <h2>XSD Viewer</h2>
            <p>Просмотр, визуализация и валидация XSD-схем</p>
            <p className="welcome-sub">ЭТРН, ФНС, ФСС, Росреестр и другие ГИС</p>
            <button className="btn btn--primary btn--lg" onClick={openXsd}>
              Открыть XSD-файл
            </button>
          </div>
        </div>
      ) : (
        <div className="workspace">
          <aside className="sidebar" style={{ width: sidebarWidth }}>
            <XsdTree
              schema={schema}
              filePath={filePath}
              selected={selected}
              search={search}
              onSelect={onSelect}
            />
          </aside>

          <div className="resize-handle" onMouseDown={onMouseDown} />

          <main className="main-panel">
            <div className="tab-bar">
              <button
                className={`tab ${tab === 'graph' ? 'tab--active' : ''}`}
                onClick={() => setTab('graph')}
              >
                Граф
              </button>
              <button
                className={`tab ${tab === 'detail' ? 'tab--active' : ''}`}
                onClick={() => setTab('detail')}
              >
                Детали
              </button>
              <button
                className={`tab ${tab === 'source' ? 'tab--active' : ''}`}
                onClick={() => setTab('source')}
              >
                Источник
              </button>
              <button
                className={`tab ${tab === 'validate' ? 'tab--active' : ''}`}
                onClick={() => setTab('validate')}
              >
                Валидация XML
              </button>
            </div>

            <div className="tab-content">
              {tab === 'graph' && (
                <XsdGraph schema={schema} selected={selected} onSelect={onSelect} />
              )}
              {tab === 'detail' && selected && (
                <XsdDetail schema={schema} selected={selected} />
              )}
              {tab === 'detail' && !selected && (
                <div className="detail-empty-state">
                  Выберите элемент или тип в дереве слева
                </div>
              )}
              {tab === 'source' && (
                <XsdSource
                  content={xsdContent}
                  schema={schema}
                  selected={selected}
                  onSelect={onSelect}
                />
              )}
              {tab === 'validate' && <XmlValidator xsdContent={xsdContent} />}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

function XsdDetail({ schema, selected }: { schema: XsdSchema; selected: SelectedItem }) {
  return (
    <div className="detail-scroll">
      <TypeDetail schema={schema} selected={selected} />
    </div>
  );
}
