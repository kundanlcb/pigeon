import { Shield } from 'lucide-react';

export function SecurityHub() {
  return (
    <div className="flex-1 flex flex-col h-full bg-editor-bg text-text-primary">
      <div className="flex items-center space-x-3 p-4 border-b border-border-strong bg-panel-bg shrink-0">
        <Shield className="text-accent" size={20} />
        <h2 className="text-sm font-semibold">DevSecOps Collection Scanner</h2>
      </div>
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <div className="text-center max-w-md">
          <Shield size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-sm font-medium text-text-primary mb-2">Collection-Level Security Audit</h3>
          <p className="text-xs leading-relaxed">
            Select a collection from the sidebar to configure the master auth tokens and run the complete security matrix against all endpoints simultaneously.
          </p>
        </div>
      </div>
    </div>
  );
}
