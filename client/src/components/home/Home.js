import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Users, Map, PencilRuler, FolderOpen, ArrowRight, ShieldCheck, PlayCircle } from 'lucide-react';
import TokenPicker from './TokenPicker';
import BrandLogo from '../common/BrandLogo';
import useIsMobile from '../../useIsMobile';

export default function Home({ pushToast }) {
    const nav = useNavigate();
    const isMobile = useIsMobile();
    const [username, setUsername] = useState(() => localStorage.getItem('monopoly.username') || '');
    const [color, setColor] = useState(() => localStorage.getItem('monopoly.color') || '#EF4444');
    const [tokens, setTokens] = useState([]);
    const [boards, setBoards] = useState({ builtin: [], mine: [], community: [] });
    const [boardId, setBoardId] = useState('world-tour');
    const [joinCode, setJoinCode] = useState('');
    const [openRooms, setOpenRooms] = useState([]);

    useEffect(() => { api.tokens().then(setTokens).catch(() => {}); }, []);
    useEffect(() => { api.listBoards().then(setBoards).catch(() => {}); }, []);
    useEffect(() => {
        const t = setInterval(() => api.listRooms().then(setOpenRooms).catch(() => {}), 5000);
        api.listRooms().then(setOpenRooms).catch(() => {});
        return () => clearInterval(t);
    }, []);

    function persist() {
        localStorage.setItem('monopoly.username', username);
        localStorage.setItem('monopoly.color', color);
    }

    async function create() {
        if (!username.trim()) return pushToast('Pick a name first', 'error');
        persist();
        try {
            const { roomCode } = await api.createRoom({ username: username.trim(), color, boardId });
            nav(`/r/${roomCode}`);
        } catch (e) { pushToast(e.message || 'Failed to create'); }
    }
    async function join(code) {
        const trimmed = (code || joinCode).trim().toUpperCase();
        if (!trimmed) return pushToast('Enter a code');
        if (!username.trim()) return pushToast('Pick a name first');
        persist();
        try { await api.getRoom(trimmed); } catch { return pushToast('Room not found'); }
        nav(`/r/${trimmed}`);
    }

    const boardCount = (boards.builtin?.length || 0) + (boards.mine?.length || 0) + (boards.community?.length || 0);

    return (
        <div className="app-page grid-bg">
            <div className="page-shell">
                <header className="topbar">
                    <BrandLogo size={isMobile ? 28 : 36} />
                    <div className="cluster" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => nav('/maps')}>
                            <FolderOpen size={14} /> My maps
                        </button>
                        <button className="btn ghost sm" onClick={() => nav('/editor')}>
                            <PencilRuler size={14} /> Map editor
                        </button>
                    </div>
                </header>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(360px, 1fr) minmax(300px, 420px)',
                    gap: isMobile ? 16 : 24,
                    alignItems: 'start',
                }}>
                    <div className="card" style={{ padding: isMobile ? 20 : 28 }}>
                        <div className="cluster" style={{ marginBottom: 18 }}>
                            <span className="chip"><ShieldCheck size={13} /> Guest session</span>
                            <span className="chip"><Map size={13} /> {boardCount || '...'} boards</span>
                        </div>
                        <h1 className="page-title" style={{ marginBottom: 10 }}>Play MONOPOLY</h1>
                        <div className="muted" style={{ marginBottom: 26, lineHeight: 1.5 }}>
                            Create a room, choose a board, and bring players in with a code.
                        </div>

                        <label className="field">Player name</label>
                        <input
                            style={{ ...inputStyle, marginBottom: 16 }}
                            placeholder="e.g. Strategist"
                            aria-label="Player name"
                            value={username}
                            onChange={e => setUsername(e.target.value.slice(0, 24))}
                            onBlur={persist}
                        />

                        <label className="field">Token color</label>
                        <TokenPicker tokens={tokens} value={color} onChange={setColor} />

                        <label className="field" style={{ marginTop: 16 }}>Board</label>
                        <select aria-label="Board" style={{ ...inputStyle, width: '100%' }} value={boardId} onChange={e => setBoardId(e.target.value)}>
                            <optgroup label="Built-in">
                                {boards.builtin.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </optgroup>
                            {boards.mine?.length > 0 && (
                                <optgroup label="My Maps">
                                    {boards.mine.map(b => <option key={b.id} value={b.id}>{b.name}{b.isPublic ? '' : ' (Private)'}</option>)}
                                </optgroup>
                            )}
                            {boards.community?.length > 0 && (
                                <optgroup label="Community">
                                    {boards.community.map(b => <option key={b.id} value={b.id}>{b.name} — {b.authorUsername || 'Community'}</option>)}
                                </optgroup>
                            )}
                        </select>

                        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                            <button className="btn primary lg" onClick={create} style={{ flex: 1 }}>
                                <PlayCircle size={18} /> Create room
                            </button>
                        </div>

                        <div className="divider" />

                        <label className="field">Join with a code</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                style={{ ...inputStyle, flex: 1, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                                placeholder="XYZABC"
                                aria-label="Room code"
                                maxLength={6}
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === 'Enter' && join()}
                            />
                            <button className="btn" onClick={() => join()}>
                                Join <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="card">
                            <div className="section-title" style={{ marginBottom: 14 }}>
                                <Users size={14} color="var(--text-3)" />
                                Public rooms
                                <span className="chip count">{openRooms.length}</span>
                            </div>
                            {openRooms.length === 0 && (
                                <div className="empty-state" style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
                                    <BrandLogo size={24} showText={false} />
                                    <div>No public rooms are open.</div>
                                </div>
                            )}
                            {openRooms.map(r => (
                                <button key={r.roomCode} className="btn" style={{
                                    width: '100%', justifyContent: 'space-between',
                                    marginBottom: 6, padding: '10px 12px',
                                }} onClick={() => join(r.roomCode)}>
                                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.roomCode}</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>
                                            {r.host} · {r.boardName}
                                        </span>
                                    </span>
                                    <span className="chip">{r.players}/8</span>
                                </button>
                            ))}
                        </div>

                        <div className="card" style={{ padding: 16 }}>
                            <div className="section-title" style={{ marginBottom: 12 }}>
                                <PencilRuler size={14} color="var(--accent)" />
                                Map workspace
                            </div>
                            <div className="cluster">
                                <button className="btn soft" onClick={() => nav('/editor')} style={{ flex: 1 }}>
                                    <PencilRuler size={15} /> New map
                                </button>
                                <button className="btn" onClick={() => nav('/maps')} style={{ flex: 1 }}>
                                    <FolderOpen size={15} /> My maps
                                </button>
                            </div>
                            <div className="status-line" style={{ marginTop: 12 }}>
                                <span className="dot" style={{ background: 'var(--accent)', width: 8, height: 8 }} />
                                Custom boards appear in the board selector after saving.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const inputStyle = { width: '100%', fontSize: 14 };
