import { useState, useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Save, Trash2, X, FileJson, AlertCircle } from 'lucide-react';

export function DocumentEditor({
    doc,
    isNew,
    onSave,
    onCancel,
    onDelete
}: {
    doc: any;
    isNew: boolean;
    onSave: (doc: any) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (containerRef.current) {
            editorRef.current = monaco.editor.create(containerRef.current, {
                value: JSON.stringify(doc, null, 2),
                language: 'json',
                theme: 'vs-dark',
                minimap: { enabled: false },
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                scrollBeyondLastLine: false,
                renderLineHighlight: 'all',
                contextmenu: true
            });
        }
        return () => {
            editorRef.current?.dispose();
        };
    }, [doc]);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const val = editorRef.current?.getValue() || '';
            const parsed = JSON.parse(val);
            if (!parsed.id) throw new Error('Document must have an id property');
            setError(null);
            await onSave(parsed);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFormat = () => {
        try {
            const val = editorRef.current?.getValue() || '';
            const parsed = JSON.parse(val);
            editorRef.current?.setValue(JSON.stringify(parsed, null, 2));
            setError(null);
        } catch (e: any) {
            setError('Cannot format invalid JSON');
        }
    };

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            if (onDelete) await onDelete();
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <FileJson className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate text-foreground">{isNew ? 'New Document' : doc.id}</h3>
                        {!isNew && <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Editor</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleFormat}
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        Format
                    </button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                        <X className="h-3.5 w-3.5" /> Close
                    </button>
                    {!isNew && onDelete && (
                        <button
                            onClick={handleDelete}
                            className="px-3 py-1.5 text-xs font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-70"
                    >
                        <Save className="h-3.5 w-3.5" /> {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="flex items-start gap-2 px-4 py-3 bg-destructive/10 text-destructive border-b border-destructive/20 text-sm shrink-0">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="break-words">{error}</div>
                </div>
            )}

            {/* Monaco Container */}
            <div className="flex-1 relative">
                <div ref={containerRef} className="absolute inset-0" />
            </div>
        </div>
    );
}
