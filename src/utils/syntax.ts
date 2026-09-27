export function highlightJson(code: string): string {
  if (!code) return '';
  
  // First, escape HTML
  let highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Apply JSON highlighting
  highlighted = highlighted.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'text-text-primary';
      if (/^"/.test(match)) {
          if (/:$/.test(match)) {
              cls = 'text-syntax-key font-medium';
              const stringPart = match.replace(/\s*:$/, '');
              const colonPart = match.substring(stringPart.length);
              return `<span class="${cls}">${stringPart}</span>${colonPart}`;
          } else {
              cls = 'text-syntax-string';
          }
      } else if (/true|false/.test(match)) {
          cls = 'text-syntax-boolean font-medium';
      } else if (/null/.test(match)) {
          cls = 'text-syntax-null font-medium italic';
      } else {
          cls = 'text-syntax-number';
      }
      return `<span class="${cls}">${match}</span>`;
  });

  return highlighted;
}

export function isJsonString(code: string): boolean {
  if (typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(code);
      return true;
    } catch(e) {
      return true; // We return true if it LOOKS like JSON to highlight invalid JSON anyway
    }
  }
  return false;
}
