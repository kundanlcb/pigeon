import { JsonEditor } from './JsonEditor';
import { KeyValPairEditor } from './KeyValPairEditor';
import { type RequestBody, type BodyType, type RawBodyLanguage } from '../store';
import { ChevronDown } from 'lucide-react';

interface BodyEditorProps {
  body?: RequestBody | string;
  onChange: (body: RequestBody) => void;
  isBulk?: boolean;
  keyColumnWidth?: number;
  onKeyColumnWidthChange?: (width: number) => void;
}

export function BodyEditor({
  body,
  onChange,
  isBulk = false,
  keyColumnWidth,
  onKeyColumnWidthChange
}: BodyEditorProps) {
  const normalizedBody: RequestBody = typeof body === 'string' 
    ? { type: 'raw', raw: body, rawLanguage: 'json' }
    : body || { type: 'none' };

  const handleTypeChange = (type: BodyType) => {
    onChange({ ...normalizedBody, type });
  };

  const handleRawChange = (raw: string) => {
    onChange({ ...normalizedBody, raw });
  };

  const handleRawLangChange = (rawLanguage: RawBodyLanguage) => {
    onChange({ ...normalizedBody, rawLanguage });
  };

  return (
    <div className="flex flex-col h-full w-full bg-app-bg text-[13px]">
      <div className="flex items-center px-4 py-2 border-b border-border-subtle space-x-4 shrink-0 overflow-x-auto">
        {(['none', 'form-data', 'x-www-form-urlencoded', 'raw', 'binary', 'graphql'] as BodyType[]).map((type) => (
          <label key={type} className="flex items-center space-x-1.5 cursor-pointer text-text-primary whitespace-nowrap">
            <input 
              type="radio" 
              name="bodyType" 
              checked={normalizedBody.type === type} 
              onChange={() => handleTypeChange(type)}
              className="accent-accent w-3 h-3 cursor-pointer"
            />
            <span>{type === 'x-www-form-urlencoded' ? 'x-www-form-urlencoded' : type}</span>
          </label>
        ))}
        {normalizedBody.type === 'raw' && (
          <div className="relative ml-2 flex items-center border-l border-border-subtle pl-4">
            <select 
              className="bg-transparent text-accent font-medium outline-none cursor-pointer appearance-none pr-4"
              value={normalizedBody.rawLanguage || 'json'}
              onChange={(e) => handleRawLangChange(e.target.value as RawBodyLanguage)}
            >
              <option value="text">Text</option>
              <option value="json">JSON</option>
              <option value="javascript">JavaScript</option>
              <option value="html">HTML</option>
              <option value="xml">XML</option>
            </select>
            <ChevronDown size={14} className="absolute right-0 pointer-events-none text-accent" />
          </div>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden">
        {normalizedBody.type === 'none' && (
          <div className="flex items-center justify-center h-full text-text-muted italic">
            This request does not have a body
          </div>
        )}
        
        {normalizedBody.type === 'raw' && (
          <div className="absolute inset-0">
            <JsonEditor 
              language={normalizedBody.rawLanguage || 'json'}
              value={normalizedBody.raw || ''}
              onChange={handleRawChange}
            />
          </div>
        )}

        {normalizedBody.type === 'form-data' && (
          <div className="absolute inset-0">
            <KeyValPairEditor 
              items={normalizedBody.formData || []}
              onChange={(formData) => onChange({ ...normalizedBody, formData })}
              isBulk={isBulk}
              keyColumnWidth={keyColumnWidth}
              onKeyColumnWidthChange={onKeyColumnWidthChange}
            />
          </div>
        )}

        {normalizedBody.type === 'x-www-form-urlencoded' && (
          <div className="absolute inset-0">
            <KeyValPairEditor 
              items={normalizedBody.urlencoded || []}
              onChange={(urlencoded) => onChange({ ...normalizedBody, urlencoded })}
              isBulk={isBulk}
              keyColumnWidth={keyColumnWidth}
              onKeyColumnWidthChange={onKeyColumnWidthChange}
            />
          </div>
        )}

        {normalizedBody.type === 'graphql' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 border-b border-border-subtle relative">
              <div className="absolute top-0 left-0 px-3 py-1 text-[11px] font-semibold text-text-muted bg-surface-bg z-10 border-r border-b border-border-subtle rounded-br">QUERY</div>
              <JsonEditor 
                language="graphql"
                value={normalizedBody.graphql?.query || ''}
                onChange={(query) => onChange({ ...normalizedBody, graphql: { ...normalizedBody.graphql, query, variables: normalizedBody.graphql?.variables || '' } })}
              />
            </div>
            <div className="h-1/3 relative">
              <div className="absolute top-0 left-0 px-3 py-1 text-[11px] font-semibold text-text-muted bg-surface-bg z-10 border-r border-b border-border-subtle rounded-br">GRAPHQL VARIABLES</div>
              <JsonEditor 
                language="json"
                value={normalizedBody.graphql?.variables || ''}
                onChange={(variables) => onChange({ ...normalizedBody, graphql: { ...normalizedBody.graphql, query: normalizedBody.graphql?.query || '', variables } })}
              />
            </div>
          </div>
        )}

        {normalizedBody.type === 'binary' && (
          <div className="flex items-center justify-center h-full text-text-muted italic">
            Binary file uploads are not supported yet.
          </div>
        )}
      </div>
    </div>
  );
}
