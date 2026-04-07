import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { DocumentEditor } from '../DocumentEditor/DocumentEditor';
import { ResizeHandle } from '../ResizeHandle/ResizeHandle';
import { useHorizontalResize } from '../../hooks/useHorizontalResize';
import { cn } from '../../lib/utils';
import { FileJson, Plus, RefreshCw, ChevronRight, File, Search } from 'lucide-react';

type ContainerDocument = Record<string, unknown> & { id?: string };

const DOCUMENT_LIST_DEFAULT_WIDTH = 420;
const DOCUMENT_LIST_MIN_WIDTH = 280;
const DOCUMENT_EDITOR_MIN_WIDTH = 360;

export function ContainerView({
    connId,
    dbId,
    contId,
    querySuffix,
    onQueryChange
}: {
    connId: string,
    dbId: string,
    contId: string,
    querySuffix: string,
    onQueryChange: (q: string) => void
}) {
    const [documents, setDocuments] = useState<ContainerDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState<string | undefined>();
    const [selectedDoc, setSelectedDoc] = useState<{ doc: ContainerDocument, isNew: boolean } | null>(null);
    const [orderBy, setOrderBy] = useState<'DESC' | 'ASC'>('DESC');
    const layoutRef = useRef<HTMLDivElement>(null);

    const {
        size: documentListWidth,
        isResizing: isDocumentListResizing,
        startResizing: startDocumentListResize,
        handleKeyDown: handleDocumentListResizeKeyDown,
        resetSize: resetDocumentListWidth
    } = useHorizontalResize({
        containerRef: layoutRef,
        storageKey: 'cosmos-client.layout.document-list-width',
        defaultSize: DOCUMENT_LIST_DEFAULT_WIDTH,
        minSize: DOCUMENT_LIST_MIN_WIDTH,
        getMaxSize: containerWidth => containerWidth - DOCUMENT_EDITOR_MIN_WIDTH
    });

    const loadDocs = async (continuation?: string, overrideOrderBy?: 'DESC' | 'ASC') => {
        setLoading(true);
        const currentOrder = overrideOrderBy || orderBy;
        try {
            const baseQuery = `SELECT * FROM c ${querySuffix}`.trim();
            const fullQuery = baseQuery.toUpperCase().includes('ORDER BY')
                ? baseQuery
                : `${baseQuery} ORDER BY c._ts ${currentOrder}`;

            // Because ordering is required, we always use queryDocuments
            const res = await window.api.queryDocuments(connId, dbId, contId, fullQuery, 50, continuation);
            const nextDocuments = (res.documents ?? []) as ContainerDocument[];

            if (continuation) {
                setDocuments(prev => [...prev, ...nextDocuments]);
            } else {
                setDocuments(nextDocuments);
            }
            setToken(res.continuationToken);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            alert('Failed to load documents: ' + message);
        }
        setLoading(false);
    };

    const loadInitialDocs = useEffectEvent(() => {
        void loadDocs();
    });

    useEffect(() => {
        loadInitialDocs();
    }, []);

    const handleSave = async (doc: ContainerDocument) => {
        if (selectedDoc?.isNew) {
            await window.api.createDocument(connId, dbId, contId, doc);
        } else {
            await window.api.replaceDocument(connId, dbId, contId, doc);
        }
        setSelectedDoc(null);
        void loadDocs();
    };

    const handleDelete = async () => {
        if (!selectedDoc || selectedDoc.isNew) return;
        const docId = selectedDoc.doc.id;
        if (!docId) return;
        try {
            await window.api.deleteDocument(connId, dbId, contId, docId);
            setSelectedDoc(null);
            void loadDocs();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            alert('Failed to delete: ' + message);
        }
    };

    return (
        <div ref={layoutRef} className="flex h-full w-full overflow-hidden bg-background">
            {/* Left Panel: Document List */}
            <div
                className={cn('flex min-w-0 shrink-0 flex-col')}
                style={{ width: `${documentListWidth}px` }}
            >
                {/* Header Toolbar */}
                <div className="flex items-center justify-between p-3 border-b border-border bg-card shrink-0">
                    <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold truncate max-w-[140px]">{contId}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{documents.length}{token ? '+' : ''} docs</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => loadDocs()}
                            disabled={loading}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <button
                            onClick={() => setSelectedDoc({ doc: { id: `new-doc-${Date.now()}` }, isNew: true })}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <Plus className="h-3.5 w-3.5" /> New
                        </button>
                    </div>
                </div>

                {/* Quick Query Input */}
                <div className="p-2 border-b border-border bg-card/50 flex items-center gap-2 shrink-0">
                    <div className="flex-1 flex items-center bg-background border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-primary">
                        <span className="pl-3 pr-1 py-1.5 text-xs font-mono text-muted-foreground select-none whitespace-nowrap">
                            SELECT * FROM c
                        </span>
                        <input
                            type="text"
                            value={querySuffix}
                            onChange={e => onQueryChange(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadDocs()}
                            placeholder="WHERE c.id = '123'"
                            className="flex-1 bg-transparent px-2 py-1.5 text-xs font-mono placeholder:text-muted-foreground/50 focus:outline-none"
                        />
                    </div>
                    <select
                        value={orderBy}
                        onChange={e => {
                            const val = e.target.value as 'DESC' | 'ASC';
                            setOrderBy(val);
                            loadDocs(undefined, val);
                        }}
                        className="bg-background border border-input rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
                    >
                        <option value="DESC">Sort: Descending</option>
                        <option value="ASC">Sort: Ascending</option>
                    </select>
                    <button
                        onClick={() => loadDocs()}
                        disabled={loading}
                        className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                        title="Run Query"
                    >
                        <Search className="h-3.5 w-3.5" />
                        Query
                    </button>
                </div>

                {/* List Body */}
                <div className="flex-1 overflow-y-auto bg-card/30 p-2 space-y-1">
                    {!loading && documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-lg mx-2 mt-4">
                            <FileJson className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm font-medium">No documents found</p>
                            <p className="text-xs mt-1">Click New to create one.</p>
                        </div>
                    ) : (
                        documents.map((doc, i) => {
                            const isSelected = selectedDoc?.doc.id === doc.id;
                            return (
                                <div
                                    key={doc.id || i}
                                    onClick={() => setSelectedDoc({ doc, isNew: false })}
                                    className={`group flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-card border-border/50 hover:border-border hover:bg-muted/50'}`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                            {doc.id}
                                        </h4>
                                        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`} />
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate font-mono opacity-70">
                                        {JSON.stringify(doc).substring(0, 100)}...
                                    </p>
                                </div>
                            );
                        })
                    )}

                    {loading && documents.length > 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground animate-pulse">
                            Loading more...
                        </div>
                    )}

                    {token && !loading && (
                        <button
                            onClick={() => loadDocs(token)}
                            className="w-full mt-2 py-2 text-xs font-medium rounded-md text-muted-foreground border border-dashed border-border hover:bg-muted transition-colors"
                        >
                            Load More
                        </button>
                    )}
                </div>
            </div>

            <ResizeHandle
                ariaLabel="Resize document list panel"
                isActive={isDocumentListResizing}
                onMouseDown={startDocumentListResize}
                onKeyDown={handleDocumentListResizeKeyDown}
                onDoubleClick={resetDocumentListWidth}
                className="bg-card/10"
            />

            {/* Right Panel: Editor / Empty State */}
            {selectedDoc ? (
                <div className="flex-1 min-w-[360px] bg-background z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)]">
                    <DocumentEditor
                        key={selectedDoc.doc.id || 'new'}
                        doc={selectedDoc.doc}
                        isNew={selectedDoc.isNew}
                        onSave={handleSave}
                        onCancel={() => setSelectedDoc(null)}
                        onDelete={handleDelete}
                    />
                </div>
            ) : (
                <div className="flex flex-1 min-w-[360px] flex-col items-center justify-center bg-background/50 p-8 text-muted-foreground">
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                        <File className="h-10 w-10 opacity-40" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No Document Selected</h3>
                    <p className="text-sm text-center max-w-[250px]">
                        Select a document from the list to view or edit its contents.
                    </p>
                </div>
            )}
        </div>
    );
}
