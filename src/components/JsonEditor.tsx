import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect } from 'react';
import { useStore } from '../store';

interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  bgType?: 'app' | 'panel';
  language?: 'json' | 'javascript';
}

export function JsonEditor({ value, onChange, readOnly = false, bgType = 'app', language = 'json' }: JsonEditorProps) {
  const monaco = useMonaco();
  const theme = useStore(state => state.theme);
  
  useEffect(() => {
    if (monaco) {
      // Small timeout ensures CSS variables are updated in the DOM after theme toggle
      setTimeout(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const getVar = (name: string, fallback: string) => rootStyle.getPropertyValue(name).trim() || fallback;
        
        const keyColor = getVar('--color-syntax-key', '#60a5fa');
        const stringColor = getVar('--color-syntax-string', '#fb923c');
        const numberColor = getVar('--color-syntax-number', '#4ade80');
        const booleanColor = getVar('--color-syntax-boolean', '#c084fc');
        
        const background = bgType === 'panel' ? getVar('--color-panel-bg', '#121214') : getVar('--color-app-bg', '#09090b');
        const lineHighlight = getVar('--color-surface-bg', '#18181b');
        const lineNumber = getVar('--color-text-muted', '#52525b');
        
        const baseTheme = theme === 'light' ? 'vs' : 'vs-dark';
        const themeName = `pigeon-${theme}-${bgType}`;

        monaco.editor.defineTheme(themeName, {
          base: baseTheme,
          inherit: true,
          rules: [
            { token: 'string.key.json', foreground: keyColor.replace('#', '') },
            { token: 'string.value.json', foreground: stringColor.replace('#', '') },
            { token: 'number', foreground: numberColor.replace('#', '') },
            { token: 'keyword.json', foreground: booleanColor.replace('#', '') },
          ],
          colors: {
            'editor.background': background, 
            'editor.lineHighlightBackground': lineHighlight,
            'editorLineNumber.foreground': lineNumber,
          }
        });
        monaco.editor.setTheme(themeName);
      }, 0);
    }
  }, [monaco, theme, bgType]);

  return (
    <Editor
      height="100%"
      language={language}
      theme={`pigeon-${theme}-${bgType}`}
      value={value}
      onChange={(val) => onChange && onChange(val || '')}
      options={{
        minimap: { enabled: false },
        readOnly: readOnly,
        fontSize: 13,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on',
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: 'all',
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        lineHeight: 22,
      }}
      loading={<div className="p-4 text-text-muted text-sm flex items-center justify-center h-full">Loading Editor...</div>}
    />
  );
}
