import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import BrandLogo from '../common/BrandLogo';
import {
    AlertTriangle, ArrowLeft, CheckCircle2, Clipboard, ClipboardPaste,
    FilePlus2, FolderOpen, Loader2, Plus, RotateCcw, Save, X,
} from 'lucide-react';

const GROUPS = {
    brown:  '#955436', lblue:  '#aae0fa', pink:   '#d93a96', orange: '#f7941d',
    red:    '#ed1b24', yellow: '#fef200', green:  '#1fb25a', dblue:  '#0072bb',
};

const DRAFT_KEY = 'monopoly.mapBuilder.draft';
const TEMPLATE_IDS = ['classic-usa', 'world-tour', 'world-capitals'];

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function makeCustomId(name) {
    const slug = String(name || 'custom-map')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || 'custom-map';
    return `${slug}-${Date.now().toString(36)}`;
}

function property(pos, name, group, price, rent, houseCost) {
    return {
        pos, type: 'property', name, group, price, rent, houseCost,
        mortgage: Math.floor(price / 2),
        color: GROUPS[group],
    };
}

function station(pos, name) {
    return { pos, type: 'station', name, price: 200, mortgage: 100 };
}

function utility(pos, name) {
    return { pos, type: 'utility', name, price: 150, mortgage: 75 };
}

function generateBlankBoard(name) {
    return {
        id: makeCustomId(name),
        name,
        description: '',
        isPublic: false,
        groupColors: GROUPS,
        tiles: [
            { pos: 0, type: 'go', name: 'GO' },
            property(1, 'Brown Property 1', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
            { pos: 2, type: 'chest', name: 'Community Chest' },
            property(3, 'Brown Property 2', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
            { pos: 4, type: 'tax', name: 'Income Tax', amount: 200 },
            station(5, 'Station 1'),
            property(6, 'Light Blue Property 1', 'lblue', 100, [6, 30, 90, 270, 400, 550], 50),
            { pos: 7, type: 'chance', name: 'Chance' },
            property(8, 'Light Blue Property 2', 'lblue', 100, [6, 30, 90, 270, 400, 550], 50),
            property(9, 'Light Blue Property 3', 'lblue', 120, [8, 40, 100, 300, 450, 600], 50),
            { pos: 10, type: 'jail', name: 'Jail / Just Visiting' },
            property(11, 'Pink Property 1', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
            utility(12, 'Utility 1'),
            property(13, 'Pink Property 2', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
            property(14, 'Pink Property 3', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
            station(15, 'Station 2'),
            property(16, 'Orange Property 1', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
            { pos: 17, type: 'chest', name: 'Community Chest' },
            property(18, 'Orange Property 2', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
            property(19, 'Orange Property 3', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
            { pos: 20, type: 'parking', name: 'Free Parking' },
            property(21, 'Red Property 1', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
            { pos: 22, type: 'chance', name: 'Chance' },
            property(23, 'Red Property 2', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
            property(24, 'Red Property 3', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
            station(25, 'Station 3'),
            property(26, 'Yellow Property 1', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
            property(27, 'Yellow Property 2', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
            utility(28, 'Utility 2'),
            property(29, 'Yellow Property 3', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
            { pos: 30, type: 'gotojail', name: 'Go to Jail' },
            property(31, 'Green Property 1', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
            property(32, 'Green Property 2', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
            { pos: 33, type: 'chest', name: 'Community Chest' },
            property(34, 'Green Property 3', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
            station(35, 'Station 4'),
            { pos: 36, type: 'chance', name: 'Chance' },
            property(37, 'Dark Blue Property 1', 'dblue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
            { pos: 38, type: 'tax', name: 'Luxury Tax', amount: 100 },
            property(39, 'Dark Blue Property 2', 'dblue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
        ],
    };
}

function normalizeTile(tile) {
    const t = { ...tile, pos: Number(tile.pos) };
    if (t.type === 'property') {
        t.price = Number(t.price || 0);
        t.houseCost = Number(t.houseCost || 0);
        t.mortgage = Number.isFinite(Number(t.mortgage)) ? Number(t.mortgage) : Math.floor(t.price / 2);
        t.rent = Array.from({ length: 6 }, (_, i) => Number(t.rent?.[i] || 0));
        t.color = GROUPS[t.group] || t.color;
    }
    if (t.type === 'station' || t.type === 'utility') {
        t.price = Number(t.price || 0);
        t.mortgage = Number.isFinite(Number(t.mortgage)) ? Number(t.mortgage) : Math.floor(t.price / 2);
    }
    if (t.type === 'tax') t.amount = Number(t.amount || 0);
    return t;
}

function validateBoard(board, name) {
    const errs = [];
    const allowed = new Set(['go', 'property', 'station', 'utility', 'tax', 'chance', 'chest', 'jail', 'gotojail', 'parking']);
    if (!name?.trim()) errs.push('Map name is required.');
    if (!board?.tiles || board.tiles.length !== 40) errs.push('Board must have exactly 40 tiles.');
    if (board?.tiles?.[0]?.type !== 'go') errs.push('Tile 0 must be GO.');
    if (board?.tiles?.[10]?.type !== 'jail') errs.push('Tile 10 must be Jail.');
    if (board?.tiles?.[30]?.type !== 'gotojail') errs.push('Tile 30 must be Go To Jail.');
    for (const [i, tile] of (board?.tiles || []).entries()) {
        if (tile.pos !== i) errs.push(`Tile ${i} has an invalid position.`);
        if (!allowed.has(tile.type)) errs.push(`Tile ${i} has an invalid type.`);
        if (!String(tile.name || '').trim()) errs.push(`Tile ${i} needs a name.`);
        if (tile.type === 'property') {
            if (!GROUPS[tile.group]) errs.push(`Property ${i} needs a valid group.`);
            if (!Array.isArray(tile.rent) || tile.rent.length !== 6) errs.push(`Property ${i} needs six rent values.`);
            if (!Number.isFinite(Number(tile.price))) errs.push(`Property ${i} needs a price.`);
            if (!Number.isFinite(Number(tile.houseCost))) errs.push(`Property ${i} needs a house cost.`);
        }
        if ((tile.type === 'station' || tile.type === 'utility') && !Number.isFinite(Number(tile.price))) {
            errs.push(`${tile.type} ${i} needs a price.`);
        }
        if (tile.type === 'tax' && !Number.isFinite(Number(tile.amount))) {
            errs.push(`Tax tile ${i} needs an amount.`);
        }
    }
    return errs;
}

export default function MapEditor({ pushToast }) {
    const nav = useNavigate();
    const { boardId } = useParams();
    const [board, setBoard] = useState(null);
    const [baseBoard, setBaseBoard] = useState(null);
    const [presets, setPresets] = useState([]);
    const [selected, setSelected] = useState('world-tour');
    const [name, setName] = useState('My Custom Board');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [newMapOpen, setNewMapOpen] = useState(false);
    const [draftAvailable, setDraftAvailable] = useState(false);
    const [draftStatus, setDraftStatus] = useState('');
    const [tileClipboard, setTileClipboard] = useState(null);

    useEffect(() => {
        api.listBoards().then(({ builtin }) => setPresets(builtin || [])).catch(() => {});
        setDraftAvailable(!!localStorage.getItem(DRAFT_KEY));
    }, []);

    // Route/template loading is intentionally driven only by these two values.
    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        if (boardId) loadExistingBoard(boardId);
        else loadTemplate(selected);
    }, [boardId, selected]);
    /* eslint-enable react-hooks/exhaustive-deps */

    useEffect(() => {
        function warn(e) {
            if (!dirty) return;
            e.preventDefault();
            e.returnValue = '';
        }
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    useEffect(() => {
        if (!board || !dirty) return;
        const timer = setTimeout(() => {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                board, baseBoard, name, description, isPublic, savedAt: Date.now(),
            }));
            setDraftAvailable(true);
            setDraftStatus('Draft autosaved');
        }, 600);
        return () => clearTimeout(timer);
    }, [board, baseBoard, name, description, isPublic, dirty]);

    async function loadExistingBoard(id) {
        setLoading(true);
        try {
            const loaded = await api.getBoard(id);
            const editable = { ...loaded, groupColors: loaded.groupColors || GROUPS, tiles: loaded.tiles.map(normalizeTile) };
            setBoard(clone(editable));
            setBaseBoard(clone(editable));
            setName(editable.name || 'My Custom Board');
            setDescription(editable.description || '');
            setIsPublic(editable.isPublic !== false);
            setDirty(false);
            setDraftStatus('');
        } catch (e) {
            pushToast(e.message || 'Failed to load board');
        } finally {
            setLoading(false);
        }
    }

    async function loadTemplate(id) {
        setLoading(true);
        try {
            const loaded = await api.getBoard(id);
            const remixName = `${loaded.name} Remix`;
            const editable = {
                ...loaded,
                id: makeCustomId(remixName),
                name: remixName,
                description: '',
                isPublic: true,
                builtin: false,
                groupColors: loaded.groupColors || GROUPS,
                tiles: loaded.tiles.map(normalizeTile),
            };
            setBoard(clone(editable));
            setBaseBoard(clone(editable));
            setName(remixName);
            setDescription('');
            setIsPublic(true);
            setDirty(false);
            setDraftStatus('');
        } catch (e) {
            pushToast(e.message || 'Failed to load starter board');
        } finally {
            setLoading(false);
        }
    }

    const validationErrors = useMemo(() => validateBoard(board, name), [board, name]);
    const canSave = board && !validationErrors.length && !saving;

    function markDirty() {
        setDirty(true);
        setDraftStatus('Unsaved changes');
    }

    function updateTile(pos, patch) {
        setBoard(b => ({
            ...b,
            tiles: b.tiles.map(t => t.pos === pos ? normalizeTile({ ...t, ...patch }) : t),
        }));
        markDirty();
    }

    function updateRent(pos, index, value) {
        const tile = board.tiles[pos];
        const rent = Array.from({ length: 6 }, (_, i) => Number(tile.rent?.[i] || 0));
        rent[index] = Number(value);
        updateTile(pos, { rent });
    }

    function resetTile(pos) {
        const original = baseBoard?.tiles?.[pos];
        if (!original) return;
        updateTile(pos, clone(original));
        pushToast('Tile reset', 'success');
    }

    function resetBoard() {
        if (!baseBoard) return;
        if (!window.confirm('Reset this board to the last loaded template/version?')) return;
        setBoard(clone(baseBoard));
        setName(baseBoard.name || name);
        setDescription(baseBoard.description || '');
        setIsPublic(baseBoard.isPublic !== false);
        markDirty();
        pushToast('Board reset', 'success');
    }

    function copyTile(tile) {
        setTileClipboard(clone(tile));
        pushToast('Tile copied. Paste it onto another tile of the same type.', 'success');
    }

    function pasteTile(pos) {
        const target = board.tiles[pos];
        if (!tileClipboard) return;
        if (tileClipboard.type !== target.type) return pushToast('Paste requires the same tile type.');
        const pasted = { ...clone(tileClipboard), pos: target.pos, type: target.type };
        updateTile(pos, pasted);
        pushToast('Tile duplicated', 'success');
    }

    function leave(path) {
        if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
        nav(path);
    }

    function chooseTemplate(id) {
        if (dirty && !window.confirm('Discard unsaved changes and load another template?')) return;
        setSelected(id);
    }

    function restoreDraft() {
        try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
            setBoard(draft.board);
            setBaseBoard(draft.baseBoard || draft.board);
            setName(draft.name || draft.board?.name || 'My Custom Board');
            setDescription(draft.description || '');
            setIsPublic(draft.isPublic !== false);
            setDirty(true);
            setDraftStatus('Draft restored');
            pushToast('Draft restored', 'success');
        } catch {
            pushToast('Draft could not be restored');
        }
    }

    function discardDraft() {
        localStorage.removeItem(DRAFT_KEY);
        setDraftAvailable(false);
        setDraftStatus('');
        pushToast('Draft discarded', 'success');
    }

    async function createNewMap({ mapName, mapDescription, visibility, template }) {
        setLoading(true);
        try {
            let next;
            if (template === 'blank') {
                next = generateBlankBoard(mapName);
            } else {
                const source = await api.getBoard(template);
                next = {
                    ...source,
                    id: makeCustomId(mapName),
                    name: mapName,
                    description: mapDescription,
                    isPublic: visibility === 'public',
                    builtin: false,
                    groupColors: source.groupColors || GROUPS,
                    tiles: source.tiles.map(normalizeTile),
                };
            }
            next.description = mapDescription;
            next.isPublic = visibility === 'public';
            setBoard(clone(next));
            setBaseBoard(clone(next));
            setName(mapName);
            setDescription(mapDescription);
            setIsPublic(visibility === 'public');
            setDirty(true);
            setNewMapOpen(false);
            pushToast('New map ready', 'success');
        } catch (e) {
            pushToast(e.message || 'Failed to create map');
        } finally {
            setLoading(false);
        }
    }

    async function save() {
        if (!canSave) return pushToast('Fix validation errors before saving.');
        setSaving(true);
        try {
            const saved = await api.saveBoard({
                id: board.id,
                name: name.trim(),
                description,
                isPublic,
                groupColors: GROUPS,
                tiles: board.tiles.map(normalizeTile),
            });
            const editable = { ...saved, groupColors: saved.groupColors || GROUPS, tiles: saved.tiles.map(normalizeTile) };
            setBoard(clone(editable));
            setBaseBoard(clone(editable));
            setName(editable.name);
            setDescription(editable.description || '');
            setIsPublic(editable.isPublic !== false);
            setDirty(false);
            localStorage.removeItem(DRAFT_KEY);
            setDraftAvailable(false);
            setDraftStatus('Saved');
            pushToast('Map saved', 'success');
        } catch (e) {
            pushToast(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    const templateOptions = TEMPLATE_IDS.map(id => presets.find(p => p.id === id)).filter(Boolean);

    if (loading && !board) {
        return <div className="app-page grid-bg" style={{ display: 'grid', placeItems: 'center' }}>
            <div className="card" style={{ display: 'grid', gap: 14, justifyItems: 'center', minWidth: 280 }}>
                <BrandLogo size={32} />
                <div className="status-line" style={{ justifyContent: 'center' }}>
                    <Loader2 size={16} /> Loading map builder...
                </div>
            </div>
        </div>;
    }

    return (
        <div className="app-page grid-bg">
            <div className="page-shell wide">
                <header className="topbar" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
                    <button className="btn ghost sm" onClick={() => leave('/')}>
                        <ArrowLeft size={14} /> Home
                    </button>
                    <button className="btn ghost sm" onClick={() => leave('/maps')}>
                        <FolderOpen size={14} /> My Maps
                    </button>
                    <BrandLogo size={30} showText={false} />
                    <div style={{ minWidth: 220 }}>
                        <div className="brand-title" style={{ fontSize: 28 }}>Custom Map Builder</div>
                        <div className="status-line" style={{ marginTop: 5 }}>
                            <span className="dot" style={{ background: dirty ? 'var(--warning)' : 'var(--success)', width: 8, height: 8 }} />
                            {draftStatus || '40-tile board schema'}
                        </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    {!boardId && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 12 }}>
                            Start from
                            <select value={selected} onChange={e => chooseTemplate(e.target.value)} disabled={loading} style={{ fontSize: 13 }}>
                                {(templateOptions.length ? templateOptions : [
                                    { id: 'world-tour', name: 'World Tour' },
                                    { id: 'classic-usa', name: 'Classic USA' },
                                    { id: 'world-capitals', name: 'World Capitals' },
                                ]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </label>
                    )}
                    <button className="btn" onClick={() => setNewMapOpen(true)}>
                        <FilePlus2 size={15} /> New Map
                    </button>
                    <button className="btn" onClick={resetBoard} disabled={!board || saving}>
                        <RotateCcw size={15} /> Reset Board
                    </button>
                    <button className="btn primary" onClick={save} disabled={!canSave}>
                        {saving ? <Loader2 size={15} /> : <Save size={15} />} Save
                    </button>
                </header>

                {draftAvailable && (
                    <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <AlertTriangle size={16} color="var(--warning)" />
                        <div style={{ flex: 1, color: 'var(--text-2)', fontSize: 13 }}>An autosaved draft is available.</div>
                        <button className="btn sm" onClick={restoreDraft}>Restore Draft</button>
                        <button className="btn sm ghost" onClick={discardDraft}>Discard</button>
                    </div>
                )}

                <div className="card" style={{ marginBottom: 14 }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 12,
                        alignItems: 'end',
                    }}>
                        <label style={fieldLabel}>
                            Map Name
                            <input value={name} onChange={e => { setName(e.target.value.slice(0, 80)); markDirty(); }} />
                        </label>
                        <label style={fieldLabel}>
                            Description
                            <input value={description} onChange={e => { setDescription(e.target.value.slice(0, 500)); markDirty(); }} placeholder="Optional" />
                        </label>
                        <label style={{ ...fieldLabel, minWidth: 150 }}>
                            Visibility
                            <select value={isPublic ? 'public' : 'private'} onChange={e => { setIsPublic(e.target.value === 'public'); markDirty(); }}>
                                <option value="private">Private</option>
                                <option value="public">Public</option>
                            </select>
                        </label>
                    </div>
                </div>

                <ValidationPanel errors={validationErrors} />

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 1080, fontSize: 13, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase' }}>
                                    <th style={cellStyle}>#</th>
                                    <th style={cellStyle}>Type</th>
                                    <th style={cellStyle}>Name</th>
                                    <th style={cellStyle}>Group</th>
                                    <th style={cellStyle}>Price</th>
                                    <th style={cellStyle}>House</th>
                                    <th style={cellStyle}>Tax</th>
                                    <th style={cellStyle}>Rent 0-5</th>
                                    <th style={cellStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(board?.tiles || []).map(tile => (
                                    <TileRow
                                        key={tile.pos}
                                        tile={tile}
                                        clipboard={tileClipboard}
                                        onUpdate={updateTile}
                                        onRent={updateRent}
                                        onCopy={copyTile}
                                        onPaste={pasteTile}
                                        onReset={resetTile}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {newMapOpen && (
                <NewMapModal
                    presets={templateOptions}
                    onClose={() => setNewMapOpen(false)}
                    onCreate={createNewMap}
                    loading={loading}
                />
            )}
        </div>
    );
}

function TileRow({ tile, clipboard, onUpdate, onRent, onCopy, onPaste, onReset }) {
    const canPaste = clipboard?.type === tile.type;
    return (
        <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td style={cellStyle}><span className="mono" style={{ color: 'var(--text-3)' }}>{tile.pos}</span></td>
            <td style={cellStyle}><span className="chip">{labelType(tile.type)}</span></td>
            <td style={cellStyle}>
                <input
                    value={tile.name || ''}
                    onChange={e => onUpdate(tile.pos, { name: e.target.value.slice(0, 40) })}
                    style={{ width: '100%', minWidth: 160, fontSize: 12 }}
                />
            </td>
            <td style={cellStyle}>
                {tile.type === 'property' ? (
                    <select
                        value={tile.group}
                        onChange={e => onUpdate(tile.pos, { group: e.target.value, color: GROUPS[e.target.value] })}
                        style={{ fontSize: 12 }}
                    >
                        {Object.keys(GROUPS).map(group => <option key={group} value={group}>{group}</option>)}
                    </select>
                ) : <span style={muted}>-</span>}
            </td>
            <td style={cellStyle}>
                {['property', 'station', 'utility'].includes(tile.type) ? (
                    <input
                        type="number"
                        min={0}
                        value={tile.price ?? 0}
                        onChange={e => onUpdate(tile.pos, { price: Number(e.target.value), mortgage: Math.floor(Number(e.target.value) / 2) })}
                        style={{ width: 86, fontSize: 12 }}
                    />
                ) : <span style={muted}>-</span>}
            </td>
            <td style={cellStyle}>
                {tile.type === 'property' ? (
                    <input
                        type="number"
                        min={0}
                        value={tile.houseCost ?? 0}
                        onChange={e => onUpdate(tile.pos, { houseCost: Number(e.target.value) })}
                        style={{ width: 78, fontSize: 12 }}
                    />
                ) : <span style={muted}>-</span>}
            </td>
            <td style={cellStyle}>
                {tile.type === 'tax' ? (
                    <input
                        type="number"
                        min={0}
                        value={tile.amount ?? 0}
                        onChange={e => onUpdate(tile.pos, { amount: Number(e.target.value) })}
                        style={{ width: 84, fontSize: 12 }}
                    />
                ) : <span style={muted}>-</span>}
            </td>
            <td style={cellStyle}>
                {tile.type === 'property' ? (
                    <div style={{ display: 'flex', gap: 3 }}>
                        {Array.from({ length: 6 }, (_, i) => (
                            <input
                                key={i}
                                type="number"
                                min={0}
                                value={tile.rent?.[i] ?? 0}
                                onChange={e => onRent(tile.pos, i, e.target.value)}
                                style={{ width: 54, fontSize: 11, padding: 4 }}
                                title={`Rent ${i}`}
                            />
                        ))}
                    </div>
                ) : <span style={muted}>-</span>}
            </td>
            <td style={cellStyle}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn sm" onClick={() => onCopy(tile)} title="Duplicate tile">
                        <Clipboard size={13} /> Duplicate
                    </button>
                    <button className="btn sm" disabled={!canPaste} onClick={() => onPaste(tile.pos)} title="Paste duplicated tile">
                        <ClipboardPaste size={13} /> Paste
                    </button>
                    <button className="btn sm ghost" onClick={() => onReset(tile.pos)} title="Reset tile">
                        <RotateCcw size={13} /> Reset
                    </button>
                </div>
            </td>
        </tr>
    );
}

function ValidationPanel({ errors }) {
    if (!errors.length) {
        return (
            <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13 }}>
                <CheckCircle2 size={16} /> Board is valid.
            </div>
        );
    }
    return (
        <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(248,113,113,0.55)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, marginBottom: 8 }}>
                <AlertTriangle size={16} /> Validation Errors
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
                {errors.slice(0, 12).map(err => <li key={err}>{err}</li>)}
                {errors.length > 12 && <li>{errors.length - 12} more...</li>}
            </ul>
        </div>
    );
}

function NewMapModal({ presets, onClose, onCreate, loading }) {
    const [mapName, setMapName] = useState('My Custom Board');
    const [mapDescription, setMapDescription] = useState('');
    const [visibility, setVisibility] = useState('private');
    const [template, setTemplate] = useState('blank');

    const options = [
        { id: 'blank', name: 'Blank' },
        ...(presets.length ? presets : [
            { id: 'classic-usa', name: 'Classic USA' },
            { id: 'world-tour', name: 'World Tour' },
            { id: 'world-capitals', name: 'World Capitals' },
        ]),
    ];

    function submit(e) {
        e.preventDefault();
        const name = mapName.trim();
        if (!name) return;
        onCreate({ mapName: name, mapDescription: mapDescription.trim(), visibility, template });
    }

    return (
        <div className="modal-backdrop fade-in" style={{ zIndex: 50 }}>
            <form className="modal-panel slide-up" onSubmit={submit} style={{ width: 'min(100%, 520px)' }}>
                <div className="modal-header">
                    <Plus size={18} color="var(--accent)" />
                    <div className="modal-title" style={{ flex: 1 }}>New Map</div>
                    <button type="button" className="btn sm icon ghost" onClick={onClose} aria-label="Close new map"><X size={14} /></button>
                </div>

                <div style={{ display: 'grid', gap: 12, padding: 20 }}>
                    <label style={fieldLabel}>
                        Map Name
                        <input value={mapName} onChange={e => setMapName(e.target.value.slice(0, 80))} autoFocus />
                    </label>
                    <label style={fieldLabel}>
                        Description
                        <textarea value={mapDescription} onChange={e => setMapDescription(e.target.value.slice(0, 500))} rows={3} placeholder="Optional" />
                    </label>
                    <label style={fieldLabel}>
                        Visibility
                        <select value={visibility} onChange={e => setVisibility(e.target.value)}>
                            <option value="private">Private</option>
                            <option value="public">Public</option>
                        </select>
                    </label>
                    <label style={fieldLabel}>
                        Template
                        <select value={template} onChange={e => setTemplate(e.target.value)}>
                            {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                        </select>
                    </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 20px 20px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn primary" disabled={loading || !mapName.trim()}>
                        {loading ? <Loader2 size={15} /> : <Plus size={15} />} Create
                    </button>
                </div>
            </form>
        </div>
    );
}

function labelType(type) {
    return ({
        go: 'GO',
        property: 'Property',
        station: 'Station',
        utility: 'Utility',
        tax: 'Tax',
        chance: 'Chance',
        chest: 'Chest',
        jail: 'Jail',
        gotojail: 'Go To Jail',
        parking: 'Free Parking',
    })[type] || type;
}

const fieldLabel = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-3)',
};
const cellStyle = { padding: '8px 10px', textAlign: 'left', verticalAlign: 'middle' };
const muted = { color: 'var(--text-4)' };
