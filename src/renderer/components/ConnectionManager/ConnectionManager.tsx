import { useState, useEffect } from 'react';
import { Server, Edit2, Trash2, Plus, Play, Save, X, Database } from 'lucide-react';
import type { CosmosConnectionProfile } from '../../../shared/types';

export function ConnectionManager({ onSelect }: { onSelect: (id: string) => void }) {
    const [connections, setConnections] = useState<CosmosConnectionProfile[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<Partial<CosmosConnectionProfile>>({});
    const [testStatus, setTestStatus] = useState<string | null>(null);

    useEffect(() => {
        window.api.getConnections().then(setConnections);
    }, []);

    const handleSave = async () => {
        if (!form.name || !form.endpoint || !form.key) {
            alert('Name, endpoint, and key are required');
            return;
        }
        let updated;
        if (form.id) {
            updated = await window.api.updateConnection(form as CosmosConnectionProfile);
        } else {
            updated = await window.api.addConnection({ ...form, id: Date.now().toString() } as CosmosConnectionProfile);
        }
        setConnections(updated);
        window.dispatchEvent(new Event('cosmos:connections-changed'));
        setShowForm(false);
        setTestStatus(null);
    };

    const handleTestConnection = async () => {
        if (!form.endpoint || !form.key) {
            setTestStatus('Endpoint and Key required to test');
            return;
        }
        setTestStatus('Testing...');
        const res = await window.api.testConnection(form.endpoint, form.key);
        if (res.success) {
            setTestStatus('Success! Connected.');
        } else {
            setTestStatus('Failed: ' + res.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete connection?')) {
            const updated = await window.api.deleteConnection(id);
            setConnections(updated);
            window.dispatchEvent(new Event('cosmos:connections-changed'));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* List Connections */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connections.map(conn => (
                    <div key={conn.id} className="relative group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-border/80 cursor-pointer" onClick={() => onSelect(conn.id)}>
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Server className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold tracking-tight truncate">{conn.name}</h3>
                                    <p className="text-xs text-muted-foreground truncate" title={conn.endpoint}>{conn.endpoint.replace('https://', '').split('.')[0]}</p>
                                </div>
                            </div>
                            {conn.defaultDatabase && (
                                <div className="mt-2 text-xs flex items-center gap-1.5 text-muted-foreground">
                                    <Database className="h-3 w-3" />
                                    {conn.defaultDatabase}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex gap-2" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => { setForm(conn); setShowForm(true); setTestStatus(null); }}
                                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
                            >
                                <Edit2 className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                                onClick={() => handleDelete(conn.id)}
                                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add New Card */}
                <button
                    onClick={() => { setForm({}); setShowForm(true); setTestStatus(null); }}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-transparent p-6 text-muted-foreground hover:bg-muted/30 hover:text-foreground hover:border-border transition-all min-h-[140px]"
                >
                    <div className="p-3 rounded-full bg-muted/50 mb-2">
                        <Plus className="h-6 w-6" />
                    </div>
                    <span className="font-medium">Add New Connection</span>
                </button>
            </div>

            {/* Connection Form Modal / Section */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-border px-6 py-4">
                            <h3 className="text-lg font-semibold">{form.id ? 'Edit Connection' : 'New Connection'}</h3>
                            <button onClick={() => { setShowForm(false); setTestStatus(null); }} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Connection Name</label>
                                <input
                                    placeholder="e.g. Production Cluster"
                                    value={form.name || ''}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Endpoint URI</label>
                                <input
                                    placeholder="https://my-account.documents.azure.com:443/"
                                    value={form.endpoint || ''}
                                    onChange={e => setForm({ ...form, endpoint: e.target.value })}
                                    className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Primary Key</label>
                                <input
                                    placeholder="Paste access key here"
                                    type="password"
                                    value={form.key || ''}
                                    onChange={e => setForm({ ...form, key: e.target.value })}
                                    className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Default Database <span className="opacity-50 font-normal">(optional)</span></label>
                                <input
                                    placeholder="Target DB Name"
                                    value={form.defaultDatabase || ''}
                                    onChange={e => setForm({ ...form, defaultDatabase: e.target.value })}
                                    className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            {testStatus && (
                                <div className={`text-sm p-3 rounded-md ${testStatus.startsWith('Success') ? 'bg-green-500/10 text-green-500 border border-green-500/20' : testStatus === 'Testing...' ? 'text-muted-foreground bg-muted border border-border' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                                    {testStatus}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-4 rounded-b-xl gap-2">
                            <button
                                onClick={handleTestConnection}
                                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                disabled={testStatus === 'Testing...'}
                            >
                                <Play className="h-4 w-4" /> Test
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowForm(false); setTestStatus(null); }}
                                    className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                    <Save className="h-4 w-4" /> Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
