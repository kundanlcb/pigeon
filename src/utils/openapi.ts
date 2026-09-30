import { load } from 'js-yaml';
import type { Collection, CollectionFolder, RequestItem } from '../store';

function resolveRef(ref: string, spec: any) {
  if (!ref.startsWith('#/')) return {};
  const parts = ref.split('/').slice(1);
  let current = spec;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return {};
    }
  }
  return current;
}

export function parseOpenAPI(content: string, filename: string): Collection {
  let spec: any;
  try {
    spec = JSON.parse(content);
  } catch {
    spec = load(content);
  }
  
  if (!spec || typeof spec !== 'object') {
    throw new Error("Invalid OpenAPI/Swagger file");
  }

  const collectionName = spec.info?.title || filename || "OpenAPI Import";
  const collectionId = `col-${crypto.randomUUID()}`;
  const servers = spec.servers || [{ url: 'http://localhost' }];
  const baseUrl = servers[0]?.url || 'http://localhost';

  const folders: CollectionFolder[] = [];
  const requests: RequestItem[] = [];

  const folderMap = new Map<string, string>(); // tag name -> folder id

  const getFolderId = (tag: string) => {
    if (!folderMap.has(tag)) {
      const folderId = `folder-${crypto.randomUUID()}`;
      folderMap.set(tag, folderId);
      folders.push({
        id: folderId,
        name: tag,
        parentId: null,
        order: folders.length
      });
    }
    return folderMap.get(tag)!;
  };

  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) continue;
        
        let folderId = null;
        const op = operation as any;
        if (op.tags && op.tags.length > 0) {
          folderId = getFolderId(op.tags[0]);
        } else {
          // fallback to first part of path
          const parts = path.split('/').filter(Boolean);
          if (parts.length > 0) {
            folderId = getFolderId(parts[0]);
          }
        }

        let url = baseUrl + path;
        const headers: Record<string, string> = {};
        
        // Handle parameters
        const params = (op.parameters || []).concat((pathItem as any).parameters || []);
        const queryParams: string[] = [];
        
        for (let param of params) {
          if (param.$ref) param = resolveRef(param.$ref, spec);
          if (param.in === 'query') {
            queryParams.push(`${param.name}=${param.schema?.default || param.example || ''}`);
          } else if (param.in === 'header') {
            headers[param.name] = param.schema?.default || param.example || '';
          } else if (param.in === 'path') {
            // Replace path variables with {{var}} so pigeon handles them properly
            url = url.replace(`{${param.name}}`, `{{${param.name}}}`);
          }
        }
        
        if (queryParams.length > 0) {
          url += (url.includes('?') ? '&' : '?') + queryParams.join('&');
        }

        let body: any = undefined;
        if (op.requestBody) {
          let rb = op.requestBody;
          if (rb.$ref) rb = resolveRef(rb.$ref, spec);
          if (rb.content && rb.content['application/json']) {
            headers['Content-Type'] = 'application/json';
            
            let schema = rb.content['application/json'].schema;
            if (schema && schema.$ref) schema = resolveRef(schema.$ref, spec);
            
            let exampleBody = rb.content['application/json'].example;
            if (!exampleBody && schema && schema.example) {
              exampleBody = schema.example;
            }
            if (exampleBody) {
              body = { type: 'raw', rawLanguage: 'json', raw: typeof exampleBody === 'string' ? exampleBody : JSON.stringify(exampleBody, null, 2) };
            } else {
              body = { type: 'raw', rawLanguage: 'json', raw: '{\n\n}' };
            }
          }
        }

        requests.push({
          id: `req-${crypto.randomUUID()}`,
          name: op.summary || op.operationId || path,
          method: method.toUpperCase() as any,
          url,
          headers,
          body,
          folderId,
          order: requests.length
        });
      }
    }
  }

  return {
    id: collectionId,
    name: collectionName,
    isOpen: true,
    storageMode: 'local',
    folders,
    requests
  };
}
