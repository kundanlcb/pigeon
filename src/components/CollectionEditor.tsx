import { KeyValueEditor } from './KeyValueEditor';
import { useStore } from '../store';
import { COMMON_HEADERS } from '../utils/url';
import { useState } from 'react';

export function CollectionEditor({ collectionId }: { collectionId: string }) {
  const collection = useStore(state => state.collections.find(c => c.id === collectionId));
  const updateCollection = useStore(state => state.updateCollection);
  const [keyColumnWidth, setKeyColumnWidth] = useState(250);

  if (!collection) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-app-bg">
      <div className="px-6 py-4 border-b border-border-strong shrink-0">
        <h2 className="text-lg font-semibold text-text-primary mb-1">{collection.name}</h2>
        <p className="text-xs text-text-secondary">
          Settings configured here are applied to all requests within this collection.
        </p>
      </div>
      
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="mb-4 shrink-0">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Collection Headers</h3>
          <p className="text-xs text-text-secondary">
            These headers will be automatically appended to every request in this collection during execution.
          </p>
        </div>
        
        <div className="flex-1 min-h-0 relative border border-border-strong rounded-lg overflow-hidden bg-panel-bg">
          <KeyValueEditor
            items={collection.headers || {}}
            onChange={(newHeaders) => updateCollection(collection.id, { headers: newHeaders })}
            keyColumnWidth={keyColumnWidth}
            onKeyColumnWidthChange={setKeyColumnWidth}
            keySuggestions={COMMON_HEADERS}
            placeholderKey="Header Key"
            placeholderValue="Header Value"
          />
        </div>
      </div>
    </div>
  );
}
