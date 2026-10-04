import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect } from 'react';
import { useStore } from '../store';

let providersRegistered = false;

function registerProviders(monaco: any) {
  if (providersRegistered) return;
  providersRegistered = true;
  
  const langs = ['json', 'javascript', 'html', 'xml', 'plaintext', 'graphql'];
  langs.forEach(l => {
    // Autocomplete Provider
    monaco.languages.registerCompletionItemProvider(l, {
      triggerCharacters: ['{'],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        
        const match = textUntilPosition.match(/\{\{([^}]*)$/);
        if (!match) return { suggestions: [] };
        
        const range = {
           startLineNumber: position.lineNumber,
           endLineNumber: position.lineNumber,
           startColumn: position.column - match[1].length,
           endColumn: position.column,
        };

        const state = useStore.getState();
        const activeEnv = state.environments.find(e => e.id === state.activeEnvironmentId);
        const vars = activeEnv ? activeEnv.variables.filter(v => v.enabled) : [];

        const suggestions = vars.map(v => ({
          label: v.key,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: v.secret ? 'Secret' : v.value,
          insertText: v.key + '}}',
          range: range
        }));
        
        return { suggestions };
      }
    });

    // Hover Provider
    monaco.languages.registerHoverProvider(l, {
      provideHover: (model: any, position: any) => {
        const matches = model.findMatches('{{[^}]+}}', false, true, false, null, true);
        const match = matches.find((m: any) => 
          position.lineNumber >= m.range.startLineNumber && 
          position.lineNumber <= m.range.endLineNumber &&
          position.column >= m.range.startColumn && 
          position.column <= m.range.endColumn
        );

        if (match) {
          const varName = model.getValueInRange(match.range).slice(2, -2).trim();
          const state = useStore.getState();
          const activeEnv = state.environments.find(e => e.id === state.activeEnvironmentId);
          const v = activeEnv?.variables.find(v => v.key === varName && v.enabled);
          
          if (v) {
            return {
              range: match.range,
              contents: [
                { value: `**Environment Variable**` },
                { value: `\`${v.key}\` = ${v.secret ? '*•••••• (Secret)*' : v.value}` }
              ]
            };
          } else {
            return {
              range: match.range,
              contents: [
                { value: `**Environment Variable**` },
                { value: `⚠️ \`${varName}\` is not defined in the active environment.` }
              ]
            };
          }
        }
        return null;
      }
    });
  });
}

interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  bgType?: 'app' | 'panel';
  language?: string;
  autoFormat?: boolean;
}

export function JsonEditor({ value, onChange, readOnly = false, bgType = 'app', language = 'json', autoFormat = false }: JsonEditorProps) {
  const monaco = useMonaco();
  const theme = useStore(state => state.theme);
  
  const handleEditorDidMount = (editor: any, _monacoInstance: any) => {
    let oldDecorations: string[] = [];
    
    const updateDecorations = () => {
      const model = editor.getModel();
      if (!model) return;
      const matches = model.findMatches('{{[^}]+}}', false, true, false, null, true);
      const newDecorations = matches.map((m: any) => ({
        range: m.range,
        options: {
          inlineClassName: '!text-accent !font-bold',
        }
      }));
      oldDecorations = editor.deltaDecorations(oldDecorations, newDecorations);
    };

    editor.onDidChangeModelContent(updateDecorations);
    updateDecorations();

    if (autoFormat) {
      setTimeout(() => {
        editor.getAction('editor.action.formatDocument')?.run();
      }, 100);
    }
  };
  
  useEffect(() => {
    if (monaco) {
      registerProviders(monaco);
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
      onMount={handleEditorDidMount}
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
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          verticalSliderSize: 8,
          horizontalSliderSize: 8,
        },
      }}
      loading={<div className="p-4 text-text-muted text-sm flex items-center justify-center h-full">Loading Editor...</div>}
    />
  );
}
