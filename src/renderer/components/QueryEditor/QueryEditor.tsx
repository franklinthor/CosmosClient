import { useState, useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Play, Table, FileJson, AlertCircle } from 'lucide-react';

export function QueryEditor({ connId, dbId, contId }: { connId: string, dbId: string, contId: string }) {
    const [query, setQuery] = useState('SELECT * FROM c');
    const [results, setResults] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const editorRef = useRef<HTMLDivElement>(null);
    const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    useEffect(() => {
        if (editorRef.current && !monacoRef.current) {
            monacoRef.current = monaco.editor.create(editorRef.current, {
                value: query,
                language: 'sql',
                theme: 'vs-dark',
                minimap: { enabled: false },
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                scrollBeyondLastLine: false,
                renderLineHighlight: 'all',
            });
            monacoRef.current.onDidChangeModelContent(() => {
                setQuery(monacoRef.current?.getValue() || '');
            });
        }
        return () => {
            monacoRef.current?.dispose();
            monacoRef.current = null;
        }
    }, [contId]); // Re-create / remount when container changes

    const runQuery = async () => {
        setLoading(true);
        setError(null);
        try {
            const q = monacoRef.current?.getValue() || query;
            const res = await window.api.queryDocuments(connId, dbId, contId, q, 100);
            setResults(res.documents);
        } catch (e: any) {
            setError(e.message);
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight text-foreground">SQL Query</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{contId}</span>
                </div>
                <button
                    onClick={runQuery}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    <Play className="h-3.5 w-3.5" />
                    {loading ? 'Executing...' : 'Run Query'}
                </button>
            </div>

            {/* Monaco SQL Editor Area */}
            <div className="h-48 border-b border-border shrink-0 relative flex flex-col">
                <div ref={editorRef} className="absolute inset-0" />
            </div>

            {/* Results Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">
                        {results.length > 0 ? `${results.length} Results` : 'No Results'}
                    </span>
                    {error && (
                        <span className="flex items-center gap-1.5 text-xs text-destructive">
                            <AlertCircle className="h-3.5 w-3.5" /> {error}
                        </span>
                    )}
                </div>

                <div className="flex items-center p-0.5 bg-muted rounded-md border border-border/50">
                    <button
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Table className="h-3.5 w-3.5" /> Table
                    </button>
                    <button
                        onClick={() => setViewMode('json')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${viewMode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <FileJson className="h-3.5 w-3.5" /> JSON
                    </button>
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-auto bg-background/50 relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center text-muted-foreground animate-pulse">
                            <Play className="h-8 w-8 mb-2 opacity-50" />
                            <span className="text-sm font-medium">Executing Query...</span>
                        </div>
                    </div>
                )}

                {!loading && viewMode === 'json' && results.length > 0 && (
                    <div className="p-4">
                        <pre className="text-[13px] font-mono text-muted-foreground whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
                    </div>
                )}

                {!loading && viewMode === 'table' && results.length > 0 && (
                    <div className="w-full inline-block min-w-full align-middle p-4">
                        <div className="border border-border rounded-lg overflow-hidden bg-card">
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted/50">
                                    <tr>
                                        {Object.keys(results[0]).filter(k => !k.startsWith('_')).map(k => (
                                            <th key={k} scope="col" className="px-4 py-2 text-left text-xs font-semibold text-foreground tracking-wider whitespace-nowrap">
                                                {k}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border">
                                    {results.map((r, i) => (
                                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                                            {Object.keys(results[0]).filter(k => !k.startsWith('_')).map(k => (
                                                <td key={k} className="px-4 py-2 text-xs text-muted-foreground max-w-[300px] truncate" title={typeof r[k] === 'object' ? JSON.stringify(r[k]) : String(r[k])}>
                                                    {typeof r[k] === 'object' ? JSON.stringify(r[k]) : String(r[k])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {!loading && results.length === 0 && !error && (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        <span className="text-sm">Run a query to view results</span>
                    </div>
                )}
            </div>
        </div>
    );
}
