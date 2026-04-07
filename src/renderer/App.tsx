import { useEffect, useRef, useState } from 'react';
import './App.css';
import { ConnectionManager } from './components/ConnectionManager/ConnectionManager';
import { Explorer } from './components/Explorer/Explorer';
import { ContainerView } from './components/ContainerView/ContainerView';
import { QueryEditor } from './components/QueryEditor/QueryEditor';
import { ResizeHandle } from './components/ResizeHandle/ResizeHandle';
import { useHorizontalResize } from './hooks/useHorizontalResize';
import { Database, Plus, RefreshCw, Upload, Download, Settings } from 'lucide-react';

type ViewMode = 'welcome' | 'connections' | 'container';

const EXPLORER_DEFAULT_WIDTH = 256;
const EXPLORER_MIN_WIDTH = 220;
const MAIN_WORKSPACE_MIN_WIDTH = 620;

function App() {
  const [version, setVersion] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('connections');
  const [selectedContainer, setSelectedContainer] = useState<{ connId: string, dbId: string, contId: string } | null>(null);
  const [containerTab, setContainerTab] = useState<'docs' | 'query'>('docs');
  const [actionStatus, setActionStatus] = useState<string>('');
  const [containerQueries, setContainerQueries] = useState<Record<string, string>>({});
  const workspaceRef = useRef<HTMLDivElement>(null);

  const {
    size: explorerWidth,
    isResizing: isExplorerResizing,
    startResizing: startExplorerResize,
    handleKeyDown: handleExplorerResizeKeyDown,
    resetSize: resetExplorerWidth,
  } = useHorizontalResize({
    containerRef: workspaceRef,
    storageKey: 'cosmos-client.layout.explorer-width',
    defaultSize: EXPLORER_DEFAULT_WIDTH,
    minSize: EXPLORER_MIN_WIDTH,
    getMaxSize: containerWidth => containerWidth - MAIN_WORKSPACE_MIN_WIDTH,
  });

  useEffect(() => {
    window.api.getVersion().then(setVersion).catch(console.error);
  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      {/* Top App Bar */}
      <header className="flex h-12 w-full items-center justify-between border-b border-border bg-card px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="text-sm font-semibold tracking-tight text-primary-foreground">Cosmos Client</h1>
          {selectedContainer && (
            <div className="ml-4 flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <span className="font-medium text-foreground">{selectedContainer.contId}</span>
              <span className="mx-2 opacity-50">/</span>
              <span>{selectedContainer.dbId}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('connections')}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Connections
          </button>

          <div className="h-4 w-px bg-border mx-2" />

          <button
            disabled={!selectedContainer}
            onClick={() => { }}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh Container"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            disabled={!selectedContainer}
            onClick={async () => {
              if (!selectedContainer) return alert('Select a container first');
              setActionStatus('Exporting...');
              try {
                const res = await window.api.exportContainer(selectedContainer.connId, selectedContainer.dbId, selectedContainer.contId);
                if (res) alert(`Exported ${res.count} documents successfully.`);
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                alert('Export failed: ' + message);
              }
              setActionStatus('');
            }}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Export"
          >
            <Download className="h-4 w-4" />
          </button>

          <button
            disabled={!selectedContainer}
            onClick={async () => {
              if (!selectedContainer) return alert('Select a container first');
              setActionStatus('Importing...');
              try {
                const res = await window.api.importContainer(selectedContainer.connId, selectedContainer.dbId, selectedContainer.contId);
                if (res) alert(`Import complete. Success: ${res.successCount}, Error: ${res.errorCount}`);
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                alert('Import failed: ' + message);
              }
              setActionStatus('');
            }}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Import"
          >
            <Upload className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Split */}
      <div ref={workspaceRef} className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="flex shrink-0 flex-col bg-card/50"
          style={{ width: `${explorerWidth}px` }}
        >
          <div className="flex h-10 items-center px-4 border-b border-border/50">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Explorer</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Explorer onSelectContainer={(connId, dbId, contId) => {
              setSelectedContainer({ connId, dbId, contId });
              setViewMode('container');
              setContainerTab('docs');
            }} />
          </div>
        </aside>
        <ResizeHandle
          ariaLabel="Resize explorer panel"
          isActive={isExplorerResizing}
          onMouseDown={startExplorerResize}
          onKeyDown={handleExplorerResizeKeyDown}
          onDoubleClick={resetExplorerWidth}
          className="bg-card/20"
        />

        {/* Workspace Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
          {viewMode === 'welcome' && (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Database className="mb-4 h-16 w-16 opacity-20" />
              <h2 className="mb-2 text-xl font-semibold text-foreground">Welcome to Cosmos Client</h2>
              <p className="max-w-md text-sm">
                Select a container from the Explorer or click Connections to add a new Cosmos DB profile.
              </p>
              <button
                onClick={() => setViewMode('connections')}
                className="mt-6 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Connection
              </button>
            </div>
          )}

          {viewMode === 'connections' && (
            <div className="flex h-full flex-col p-6 overflow-y-auto">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Connections</h2>
              </div>
              <div className="mx-auto w-full max-w-4xl">
                <ConnectionManager onSelect={(id) => console.log('Selected connection:', id)} />
              </div>
            </div>
          )}

          {viewMode === 'container' && selectedContainer && (
            <div className="flex h-full flex-col">
              {/* Contextual Workspace Tabs */}
              <div className="flex h-10 shrink-0 items-center border-b border-border bg-card/30 px-2 gap-1">
                <button
                  onClick={() => setContainerTab('docs')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${containerTab === 'docs' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                >
                  Documents
                </button>
                <button
                  onClick={() => setContainerTab('query')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${containerTab === 'query' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                >
                  SQL Query
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                {containerTab === 'docs' && (
                  <ContainerView
                    key={`${selectedContainer.connId}-${selectedContainer.dbId}-${selectedContainer.contId}`}
                    connId={selectedContainer.connId}
                    dbId={selectedContainer.dbId}
                    contId={selectedContainer.contId}
                    querySuffix={containerQueries[`${selectedContainer.connId}-${selectedContainer.dbId}-${selectedContainer.contId}`] || ''}
                    onQueryChange={(q) => setContainerQueries(prev => ({ ...prev, [`${selectedContainer.connId}-${selectedContainer.dbId}-${selectedContainer.contId}`]: q }))}
                  />
                )}
                {containerTab === 'query' && (
                  <QueryEditor
                    key={`q-${selectedContainer.connId}-${selectedContainer.dbId}-${selectedContainer.contId}`}
                    connId={selectedContainer.connId}
                    dbId={selectedContainer.dbId}
                    contId={selectedContainer.contId}
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Optional Status Bar */}
      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-card px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <span>Ready</span>
          {actionStatus && <span className="text-primary animate-pulse">{actionStatus}</span>}
        </div>
        <div>v{version}</div>
      </footer>
    </div>
  );
}

export default App;
