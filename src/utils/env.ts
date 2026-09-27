import type { Environment } from "../store";

export function resolveEnvVariables(text: string, environment?: Environment | null, localVars?: Record<string, string>): string {
  if (!text) return text;
  
  let resolvedText = text;
  
  // Create a map of enabled variables
  const variables = {
    ...(environment?.variables
      .filter(v => v.enabled && v.key.trim() !== '')
      .reduce((acc, v) => {
        acc[v.key] = v.value;
        return acc;
      }, {} as Record<string, string>) || {}),
    ...(localVars || {})
  };
    
  // Replace {{var}} with value
  const regex = /\{\{([^}]+)\}\}/g;
  resolvedText = resolvedText.replace(regex, (match, key) => {
    const trimmedKey = key.trim();
    if (trimmedKey in variables) {
      return variables[trimmedKey];
    }
    return match; // Keep original if not found
  });
  
  return resolvedText;
}
