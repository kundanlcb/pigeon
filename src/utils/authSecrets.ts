import type { Collection, Environment, RequestItem } from '../store';
import { createSecretReference, deleteSecret, getSecret, setSecret } from './secrets';

const SECRET_FIELDS = [
  { value: 'bearerToken', marker: 'bearerTokenInKeychain', reference: 'bearerTokenKeychainRef' },
  { value: 'basicPassword', marker: 'basicPasswordInKeychain', reference: 'basicPasswordKeychainRef' },
  { value: 'apiKeyValue', marker: 'apiKeyValueInKeychain', reference: 'apiKeyValueKeychainRef' }
] as const;

function isEnvironmentReference(value: string): boolean {
  return /^\{\{\s*[^{}]+\s*\}\}$/.test(value.trim());
}

export async function secureImportedCollection(collection: Collection): Promise<Collection> {
  const storedReferences: string[] = [];
  try {
    const requests: RequestItem[] = [];
    for (const request of collection.requests) {
      let auth = request.auth ? { ...request.auth } : undefined;
      if (auth) {
        for (const field of SECRET_FIELDS) {
          const value = auth[field.value];
          if (!value || isEnvironmentReference(value)) continue;
          const reference = createSecretReference();
          await setSecret('request-auth', reference, value);
          storedReferences.push(reference);
          auth = {
            ...auth,
            [field.value]: '',
            [field.marker]: true,
            [field.reference]: reference
          };
        }
      }
      requests.push({ ...request, auth });
    }
    return { ...collection, requests };
  } catch (error) {
    await Promise.all(storedReferences.map(reference => deleteSecret('request-auth', reference).catch(() => {})));
    throw error;
  }
}

export async function secureImportedEnvironment(environment: Environment): Promise<Environment> {
  const id = `env-${crypto.randomUUID()}`;
  const migratedKeys: string[] = [];
  try {
    const variables = [];
    for (const variable of environment.variables) {
      const shouldBeSecret = variable.secret || /token|secret/i.test(variable.key);
      if (!shouldBeSecret) {
        variables.push(variable);
        continue;
      }
      if (variable.value) {
        await setSecret(id, variable.key, variable.value);
        migratedKeys.push(variable.key);
      }
      variables.push({ ...variable, secret: true, secretStored: !!variable.value, value: '' });
    }
    return { ...environment, id, variables };
  } catch (error) {
    await Promise.all(migratedKeys.map(key => deleteSecret(id, key).catch(() => {})));
    throw error;
  }
}

export async function duplicateEnvironmentWithSecrets(environment: Environment): Promise<Environment> {
  const id = `env-${crypto.randomUUID()}`;
  const copiedKeys: string[] = [];
  try {
    const variables = [];
    for (const variable of environment.variables) {
      if (!variable.secret) {
        variables.push({ ...variable, id: `var-${crypto.randomUUID()}` });
        continue;
      }
      const value = await getSecret(environment.id, variable.key);
      if (value === null) throw new Error(`Secret variable "${variable.key}" is missing from the system keychain.`);
      await setSecret(id, variable.key, value);
      copiedKeys.push(variable.key);
      variables.push({ ...variable, id: `var-${crypto.randomUUID()}`, value: '' });
      variables.push({ ...variable, id: `var-${crypto.randomUUID()}`, value: '', secretStored: true });
    }
    return { ...environment, id, name: `${environment.name} Copy`, variables };
  } catch (error) {
    await Promise.all(copiedKeys.map(key => deleteSecret(id, key).catch(() => {})));
    throw error;
  }
}

export async function deleteUnusedRequestSecrets(collections: Collection[], removedRequests: RequestItem[]): Promise<void> {
  const candidateReferences = new Set<string>();
  const usedReferences = new Set<string>();
  const collect = (request: RequestItem, target: Set<string>) => {
    const auth = request.auth;
    if (auth) {
      for (const reference of [auth.bearerTokenKeychainRef, auth.basicPasswordKeychainRef, auth.apiKeyValueKeychainRef]) {
        if (reference) target.add(reference);
      }
    }
    const headerReference = request.authorizationHeaderKeychainRef;
    if (headerReference) target.add(headerReference);
  };
  removedRequests.forEach(request => collect(request, candidateReferences));
  collections.forEach(collection => collection.requests.forEach(request => collect(request, usedReferences)));
  await Promise.all([...candidateReferences]
    .filter(reference => !usedReferences.has(reference))
    .map(reference => deleteSecret('request-auth', reference)));
}

export function requestSecretIsShared(collections: Collection[], requestId: string, reference: string): boolean {
  return collections.some(collection => collection.requests.some(request => {
    if (request.id === requestId) return false;
    const auth = request.auth;
    return auth?.bearerTokenKeychainRef === reference
      || auth?.basicPasswordKeychainRef === reference
      || auth?.apiKeyValueKeychainRef === reference
      || request.authorizationHeaderKeychainRef === reference;
  }));
}