import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import BrandLogo from '../common/BrandLogo';
import { ArrowLeft, Copy, Edit3, Eye, EyeOff, Loader2, Plus, Search, Trash2, Check, X } from 'lucide-react';

export default function MyMaps({ pushToast }) {
    const nav = useNavigate();
    const [maps, setMaps] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    // Load once on page entry; subsequent refreshes are explicit after actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadMaps(); }, []);

    async function loadMaps() {
        setLoading(true);
        try {
            const { boards } = await api.myBoards();
            setMaps(boards || []);
        } catch (e) {
            pushToast(e.message || 'Failed to load maps');
        } finally {
            setLoading(false);
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return maps;
        return maps.filter(m =>
            m.name?.toLowerCase().includes(q) ||
            m.description?.toLowerCase().includes(q) ||
            m.id?.toLowerCase().includes(q)
        );
    }, [maps, search]);

    async function run(id, fn, success) {
        setBusyId(id);
        try {
            await fn();
            await loadMaps();
            if (success) pushToast(success, 'success');
        } catch (e) {
            pushToast(e.message || 'Map action failed');
        } finally {
            setBusyId(null);
        }
    }

    function startRename(map) {
        setRenamingId(map.id);
        setRenameValue(map.name || '');
    }

    async function saveRename(map) {
        const name = renameValue.trim();
        if (!name) return pushToast('Map name is required');
        await run(map.id, () => api.updateBoard(map.id, { name }), 'Map renamed');
        setRenamingId(null);
        setRenameValue('');
    }

    return (
        <div className="app-page grid-bg">
            <div className="page-shell">
                <header className="topbar" style={{ marginBottom: 22, flexWrap: 'wrap' }}>
                    <button className="btn ghost sm" onClick={() => nav('/')}>
                        <ArrowLeft size={14} /> Home
                    </button>
                    <BrandLogo size={30} showText={false} />
                    <div>
                        <div className="brand-title" style={{ fontSize: 30 }}>My Maps</div>
                        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Manage custom boards saved on this browser identity.</div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <button className="btn primary" onClick={() => nav('/editor')}>
                        <Plus size={15} /> Create map
                    </button>
                </header>

                <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Search size={16} color="var(--text-3)" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search maps"
                        style={{ flex: 1, minWidth: 220, fontSize: 14 }}
                    />
                    <button className="btn sm" onClick={loadMaps} disabled={loading}>
                        {loading ? <Loader2 size={13} /> : null} Refresh
                    </button>
                </div>

                {loading && (
                    <div className="card status-line">
                        <BrandLogo size={24} showText={false} />
                        <Loader2 size={16} /> Loading maps...
                    </div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="card empty-state" style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
                        <BrandLogo size={28} showText={false} />
                        <div>No maps found.</div>
                    </div>
                )}

                {!loading && filtered.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filtered.map(map => (
                            <div key={map.id} className="card" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                gap: 14,
                                alignItems: 'center',
                            }}>
                                <div style={{ minWidth: 0 }}>
                                    {renamingId === map.id ? (
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                                            <input
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value.slice(0, 80))}
                                                onKeyDown={e => e.key === 'Enter' && saveRename(map)}
                                                style={{ minWidth: 220, maxWidth: 420, width: '100%' }}
                                                autoFocus
                                            />
                                            <button className="btn sm primary" onClick={() => saveRename(map)} disabled={busyId === map.id}>
                                                <Check size={13} /> Save
                                            </button>
                                            <button className="btn sm ghost" onClick={() => setRenamingId(null)}>
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ fontSize: 18, fontWeight: 750 }}>{map.name}</div>
                                            <span className="chip" style={{ color: map.isPublic ? 'var(--success)' : 'var(--text-3)' }}>
                                                {map.isPublic ? 'Public' : 'Private'}
                                            </span>
                                        </div>
                                    )}
                                    {map.description && (
                                        <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4 }}>{map.description}</div>
                                    )}
                                    <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 8, overflowWrap: 'anywhere' }}>
                                        {map.id} - played {map.timesPlayed || 0} times
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <button className="btn sm" onClick={() => nav(`/editor/${map.id}`)}>
                                        <Edit3 size={13} /> Edit
                                    </button>
                                    <button className="btn sm" onClick={() => startRename(map)}>
                                        Rename
                                    </button>
                                    <button
                                        className="btn sm"
                                        disabled={busyId === map.id}
                                        onClick={() => run(map.id, () => api.duplicateBoard(map.id), 'Map duplicated')}
                                    >
                                        <Copy size={13} /> Duplicate
                                    </button>
                                    <button
                                        className="btn sm"
                                        disabled={busyId === map.id}
                                        onClick={() => run(map.id, () => api.updateBoard(map.id, { isPublic: !map.isPublic }), map.isPublic ? 'Map unpublished' : 'Map published')}
                                    >
                                        {map.isPublic ? <EyeOff size={13} /> : <Eye size={13} />}
                                        {map.isPublic ? 'Unpublish' : 'Publish'}
                                    </button>
                                    <button
                                        className="btn sm danger"
                                        disabled={busyId === map.id}
                                        onClick={() => {
                                            if (window.confirm(`Delete "${map.name}"? This cannot be undone.`)) {
                                                run(map.id, () => api.deleteBoard(map.id), 'Map deleted');
                                            }
                                        }}
                                    >
                                        <Trash2 size={13} /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
