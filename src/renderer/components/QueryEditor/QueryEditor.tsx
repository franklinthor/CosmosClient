import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from 'react';
import * as monaco from 'monaco-editor';
import { Play, Table, FileJson, AlertCircle } from 'lucide-react';

export type QueryEditorSession = {
    query: string;
    results: any[];
    viewMode: 'table' | 'json';
    error: string | null;
};

export const DEFAULT_QUERY_EDITOR_SESSION: QueryEditorSession = {
    query: 'SELECT * FROM c',
    results: [],
    viewMode: 'table',
    error: null,
};

function isDisplayableObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeResultsForTable(results: unknown[]) {
    const rows = results.map(result => isDisplayableObject(result) ? result : { value: result });
    const columns: string[] = [];

    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (key.startsWith('_') || columns.includes(key)) continue;
            columns.push(key);
        }
    }

    return { rows, columns };
}

export function QueryEditor({
    connId,
    dbId,
    contId,
    session,
    onSessionChange,
}: {
    connId: string,
    dbId: string,
    contId: string,
    session: QueryEditorSession,
    onSessionChange: Dispatch<SetStateAction<QueryEditorSession>>
}) {
    const [loading, setLoading] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const onSessionChangeRef = useRef(onSessionChange);
    const tableData = normalizeResultsForTable(session.results);

    useEffect(() => {
        onSessionChangeRef.current = onSessionChange;
    }, [onSessionChange]);

    useEffect(() => {
        if (editorRef.current && !monacoRef.current) {
            monacoRef.current = monaco.editor.create(editorRef.current, {
                value: session.query,
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
                const nextQuery = monacoRef.current?.getValue() || '';
                onSessionChangeRef.current(prev => prev.query === nextQuery ? prev : { ...prev, query: nextQuery });
            });
        }
        return () => {
            monacoRef.current?.dispose();
            monacoRef.current = null;
        }
    }, [contId]); // Re-create / remount when container changes

    useEffect(() => {
        if (!monacoRef.current) return;
        if (monacoRef.current.getValue() === session.query) return;
        monacoRef.current.setValue(session.query);
    }, [session.query]);

    const runQuery = async () => {
        setLoading(true);
        onSessionChange(prev => prev.error === null ? prev : { ...prev, error: null });
        try {
            const q = monacoRef.current?.getValue() || session.query;
            const res = await window.api.queryDocuments(connId, dbId, contId, q, 100);
            onSessionChange(prev => ({
                ...prev,
                query: q,
                results: res.documents,
                error: null,
            }));
        } catch (e: any) {
            onSessionChange(prev => ({
                ...prev,
                query: monacoRef.current?.getValue() || prev.query,
                error: e.message,
            }));
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
                        {session.results.length > 0 ? `${session.results.length} Results` : 'No Results'}
                    </span>
                    {session.error && (
                        <span className="flex items-center gap-1.5 text-xs text-destructive">
                            <AlertCircle className="h-3.5 w-3.5" /> {session.error}
                        </span>
                    )}
                </div>

                <div className="flex items-center p-0.5 bg-muted rounded-md border border-border/50">
                    <button
                        onClick={() => onSessionChange(prev => ({ ...prev, viewMode: 'table' }))}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${session.viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Table className="h-3.5 w-3.5" /> Table
                    </button>
                    <button
                        onClick={() => onSessionChange(prev => ({ ...prev, viewMode: 'json' }))}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${session.viewMode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
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

                {!loading && session.viewMode === 'json' && session.results.length > 0 && (
                    <div className="p-4">
                        <pre className="text-[13px] font-mono text-muted-foreground whitespace-pre-wrap">{JSON.stringify(session.results, null, 2)}</pre>
                    </div>
                )}

                {!loading && session.viewMode === 'table' && session.results.length > 0 && (
                    <div className="w-full inline-block min-w-full align-middle p-4">
                        {tableData.columns.length > 0 ? (
                            <div className="border border-border rounded-lg overflow-hidden bg-card">
                                <table className="min-w-full divide-y divide-border">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            {tableData.columns.map(column => (
                                                <th key={column} scope="col" className="px-4 py-2 text-left text-xs font-semibold text-foreground tracking-wider whitespace-nowrap">
                                                    {column}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-card divide-y divide-border">
                                        {tableData.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                                                {tableData.columns.map(column => {
                                                    const value = row[column];
                                                    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
                                                    return (
                                                        <td key={column} className="px-4 py-2 text-xs text-muted-foreground max-w-[300px] truncate" title={displayValue}>
                                                            {displayValue}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                    Query returned rows, but none had displayable columns. Try JSON view or filter with
                                    <span className="mx-1 font-mono text-foreground">IS_DEFINED(...)</span>
                                    to exclude undefined values.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {!loading && session.results.length === 0 && !session.error && (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        <span className="text-sm">Run a query to view results</span>
                    </div>
                )}
            </div>
        </div>
    );
}
