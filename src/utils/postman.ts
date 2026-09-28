import type { Collection, CollectionFolder, Environment, RequestItem } from '../store';

export function parsePostmanCollection(json: any): Collection {
  const collectionName = json.info?.name || 'Imported Postman Collection';
  const requests: RequestItem[] = [];
  const folders: CollectionFolder[] = [];

  function extractRequests(items: any[], parentId: string | null = null) {
    let requestOrder = 0;
    let folderOrder = 0;
    for (const item of items) {
      if (item.request) {
        // It's a request
        let url = '';
        if (typeof item.request.url === 'string') {
          url = item.request.url;
        } else if (item.request.url && item.request.url.raw) {
          url = item.request.url.raw;
        }
        
        const headers: Record<string, string> = {};
        if (Array.isArray(item.request.header)) {
          item.request.header.forEach((h: any) => {
             if (h.key) headers[h.key] = h.value || '';
          });
        }
        
        let body = '';
        if (item.request.body && item.request.body.mode === 'raw' && typeof item.request.body.raw === 'string') {
          body = item.request.body.raw;
        }

        requests.push({
          id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: item.name || 'Untitled Request',
          method: (item.request.method || 'GET').toUpperCase() as any,
          url,
          headers,
          body,
          folderId: parentId,
          order: requestOrder++
        });
      } else if (item.item && Array.isArray(item.item)) {
        const folderId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        folders.push({
          id: folderId,
          name: item.name || 'Untitled Folder',
          parentId,
          order: folderOrder++
        });
        extractRequests(item.item, folderId);
      }
    }
  }

  if (Array.isArray(json.item)) {
    extractRequests(json.item);
  }

  return {
    id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: collectionName,
    requests,
    isOpen: true,
    folders
  };
}

export function parsePostmanEnvironment(json: any): Environment {
  const name = json.name || 'Imported Postman Environment';
  const variables = [];

  if (Array.isArray(json.values)) {
    for (const val of json.values) {
      variables.push({
        id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        key: val.key || '',
        value: val.value || '',
        enabled: val.enabled !== false // defaults to true
      });
    }
  }

  return {
    id: `env-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    variables
  };
}
