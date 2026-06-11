import { useState, useRef } from 'react';

interface Props {
  xsdContent: string;
}

interface ValidationError {
  message: string;
  line: number;
  column: number;
}

export default function XmlValidator({ xsdContent }: Props) {
  const [xmlContent, setXmlContent] = useState('');
  const [xmlPath, setXmlPath] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openXml = async () => {
    const path = await window.api.openFile([{ name: 'XML Files', extensions: ['xml'] }]);
    if (!path) return;
    const content = await window.api.readFile(path);
    setXmlPath(path);
    setXmlContent(content);
    setStatus('idle');
    setErrors([]);
  };

  const validate = async () => {
    if (!xmlContent.trim()) return;
    setStatus('validating');
    setErrors([]);
    const result = await window.api.validateXml(xmlContent, xsdContent);
    setStatus(result.valid ? 'ok' : 'error');
    setErrors(result.errors.filter((e) => e.message.trim()));
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const text = await file.text();
    setXmlContent(text);
    setXmlPath(file.name);
    setStatus('idle');
    setErrors([]);
  };

  const fileName = xmlPath?.split(/[\\/]/).pop() ?? null;

  return (
    <div className="validator">
      <div className="validator-toolbar">
        <button className="btn" onClick={openXml}>Открыть XML</button>
        {xmlContent && (
          <button className={`btn btn--primary`} onClick={validate} disabled={status === 'validating'}>
            {status === 'validating' ? 'Проверка…' : 'Валидировать'}
          </button>
        )}
        {fileName && <span className="validator-filename">{fileName}</span>}
        {status === 'ok' && <span className="validator-status validator-status--ok">✓ Валиден</span>}
        {status === 'error' && (
          <span className="validator-status validator-status--error">✗ {errors.length} ошибок</span>
        )}
      </div>

      <div
        className="validator-drop"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{ display: xmlContent ? 'none' : 'flex' }}
      >
        <div className="validator-drop-hint">
          <span>Перетащите XML-файл сюда</span>
          <span>или нажмите «Открыть XML»</span>
        </div>
      </div>

      {xmlContent && (
        <div className="validator-content">
          <textarea
            ref={textareaRef}
            className="validator-textarea"
            value={xmlContent}
            onChange={(e) => {
              setXmlContent(e.target.value);
              setStatus('idle');
              setErrors([]);
            }}
            spellCheck={false}
          />

          {errors.length > 0 && (
            <div className="validator-errors">
              <div className="validator-errors-title">Ошибки валидации</div>
              {errors.map((err, i) => (
                <div key={i} className="validator-error">
                  {err.line > 0 && (
                    <span className="ve-location">
                      строка {err.line}{err.column > 0 ? `:${err.column}` : ''}
                    </span>
                  )}
                  <span className="ve-message">{err.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
