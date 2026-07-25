import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar, Tooltip } from '@mantine/core';
import {
  MessageSquare, FileText, LayoutDashboard, Database,
  LogOut, Plus, PanelLeftClose, PanelLeftOpen,
  Pencil, Trash2, Check, X, Star
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { useChatStore } from '../../store/chat-store';

/* ─────────────────────────────────────────────
   Gazi Üniversitesi Kurumsal Renkleri (Pantone)
   ───────────────────────────────────────────── */
const COLORS = {
  lacivert: '#1b365d',
  lacivertHover: '#224472',
  lacivertLight: '#2c4e7e',
  acikMavi: '#e6f0fa',
  gold: '#c5a059',
  bordo: '#8f0037',
  griText: '#9ab2cf',
  beyazText: '#ffffff',
  gaziMavi: '#0B3E75',
  gaziBordo: '#E54B3B'
};

/* ─────────────────────────────────────────────
   Gazi Teknopark AI Logo Mark (1:1 & Horizontal)
   ───────────────────────────────────────────── */
const GaziLogoMark: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect width="40" height="40" rx="10" fill="url(#gazi_grad)" />
    <path
      d="M26 14C24.2 12.2 21.8 11 19 11C13.5 11 9 15.5 9 21C9 26.5 13.5 31 19 31C23.8 31 27.8 27.6 28.7 23H19V19H32.8C33 19.7 33 20.3 33 21C33 28.7 26.7 35 19 35C11.3 35 5 28.7 5 21C5 13.3 11.3 7 19 7C22.9 7 26.4 8.6 29 11.2L26 14Z"
      fill="#FFFFFF"
    />
    <path
      d="M29 8L30.2 11.8L34 13L30.2 14.2L29 18L27.8 14.2L24 13L27.8 11.8L29 8Z"
      fill={COLORS.gaziBordo}
    />
    <defs>
      <linearGradient id="gazi_grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2c4e7e" />
        <stop offset="1" stopColor="#1b365d" />
      </linearGradient>
    </defs>
  </svg>
);

/* ─────────────────────────────────────────────
   Sidebar Sohbet Öğesi
   ───────────────────────────────────────────── */
interface SidebarSessionItemProps {
  session: { id: string; title: string; is_favorite: boolean };
  isActive: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onFavorite: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (newTitle: string) => void;
}

const SidebarSessionItem: React.FC<SidebarSessionItemProps> = ({
  session, isActive, collapsed, onSelect, onFavorite, onDelete, onRename,
}) => {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(session.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    const v = editValue.trim();
    if (v && v !== session.title) onRename(v);
    setEditing(false);
  };

  const cancelEdit = () => { setEditValue(session.title); setEditing(false); };

  if (collapsed) {
    return (
      <Tooltip label={session.title} position="right" withArrow openDelay={200}>
        <button
          onClick={onSelect}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: 42, height: 42,
            margin: '3px auto',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isActive ? COLORS.lacivertLight : hovered ? COLORS.lacivertHover : 'transparent',
            transition: 'background 0.12s',
          }}
        >
          {session.is_favorite ? (
            <Star size={16} color={COLORS.gold} fill={COLORS.gold} />
          ) : (
            <MessageSquare size={16} color={isActive ? COLORS.beyazText : COLORS.griText} />
          )}
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      onClick={editing ? undefined : onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 8,
        cursor: editing ? 'default' : 'pointer',
        backgroundColor: isActive ? COLORS.lacivertLight : hovered ? COLORS.lacivertHover : 'transparent',
        transition: 'background 0.12s', position: 'relative',
      }}
    >
      <MessageSquare size={14} color={isActive ? COLORS.beyazText : COLORS.griText} style={{ flexShrink: 0 }} />

      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1, border: 'none', outline: 'none', background: COLORS.lacivertHover,
            fontSize: 13, color: COLORS.beyazText, fontFamily: 'inherit',
            borderRadius: 4, padding: '2px 6px', minWidth: 0,
          }}
        />
      ) : (
        <span style={{
          flex: 1, fontSize: 13, fontWeight: isActive ? 500 : 400,
          color: isActive ? COLORS.beyazText : '#d1dae6',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0,
        }}>
          {session.title}
        </span>
      )}

      {editing ? (
        <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button onClick={(e) => { e.stopPropagation(); commitEdit(); }} style={iconBtnDark}>
            <Check size={12} color="#4ade80" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} style={iconBtnDark}>
            <X size={12} color="#f87171" />
          </button>
        </span>
      ) : (
        <span style={{
          display: 'flex', gap: 2, flexShrink: 0,
          opacity: hovered || isActive ? 1 : 0, transition: 'opacity 0.12s',
        }}>
          <Tooltip label="Düzenle" withArrow position="top" openDelay={300}>
            <button onClick={startEdit} style={iconBtnDark}><Pencil size={12} color={COLORS.griText} /></button>
          </Tooltip>
          <Tooltip label={session.is_favorite ? 'Favoriden Çıkar' : 'Favori'} withArrow position="top" openDelay={300}>
            <button onClick={onFavorite} style={iconBtnDark}>
              <Star size={12} color={session.is_favorite ? COLORS.gold : COLORS.griText} fill={session.is_favorite ? COLORS.gold : 'none'} />
            </button>
          </Tooltip>
          <Tooltip label="Sil" withArrow position="top" openDelay={300}>
            <button onClick={onDelete} style={iconBtnDark}><Trash2 size={12} color="#f87171" /></button>
          </Tooltip>
        </span>
      )}
    </div>
  );
};

const iconBtnDark: React.CSSProperties = {
  background: 'none', border: 'none', padding: 4,
  cursor: 'pointer', borderRadius: 4, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.12s',
};

/* ─────────────────────────────────────────────
   Sidebar Navigasyon Öğesi
   ───────────────────────────────────────────── */
interface NavItemProps {
  icon: React.FC<any>;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, collapsed, onClick }) => {
  const [hov, setHov] = useState(false);

  const btnNode = (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : 10,
        width: collapsed ? 44 : '100%',
        height: collapsed ? 44 : 'auto',
        padding: collapsed ? 0 : '9px 10px',
        margin: collapsed ? '2px auto' : '0',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? COLORS.beyazText : '#cfdbe9',
        backgroundColor: active ? COLORS.lacivertLight : hov ? COLORS.lacivertHover : 'transparent',
        transition: 'all 0.15s ease',
      }}
    >
      <Icon size={18} color={active ? COLORS.beyazText : COLORS.griText} style={{ flexShrink: 0 }} />
      {!collapsed && (
        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip label={label} position="right" withArrow openDelay={150}>
        {btnNode}
      </Tooltip>
    );
  }

  return btnNode;
};

/* ─────────────────────────────────────────────
   Ana Layout Bileşeni
   ───────────────────────────────────────────── */
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fullName, role, logout } = useAuthStore();
  const {
    sessions, activeSessionId,
    fetchSessions, createSession, selectSession,
    toggleFavorite, deleteSession, renameSession,
  } = useChatStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logoHovered, setLogoHovered] = useState(false);
  const [newChatHov, setNewChatHov] = useState(false);

  useEffect(() => { fetchSessions(); }, []);

  const isChat = location.pathname === '/chat';

  const handleNewChat = async () => {
    const title = prompt('Sohbet Başlığı:', 'Yeni Sohbet');
    if (title?.trim()) {
      await createSession(title.trim());
      if (!isChat) navigate('/chat');
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    await selectSession(sessionId);
    if (!isChat) navigate('/chat');
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (window.confirm('Bu sohbet kalıcı olarak silinecek. Emin misiniz?')) {
      await deleteSession(sessionId);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = [
    { label: 'Gösterge Paneli', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'editor', 'viewer'] },
    { label: 'Belge Yönetimi', icon: FileText, path: '/documents', roles: ['admin', 'editor'] },
    { label: 'Sistem Durumu', icon: Database, path: '/system', roles: ['admin'] },
  ];

  const favoriteSessions = sessions.filter((s) => s.is_favorite);
  const regularSessions = sessions.filter((s) => !s.is_favorite);

  const userInitials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase()
    : 'U';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>

      {/* ── SIDEBAR (Gazi Üniversitesi Laciverti) ── */}
      <aside style={{
        width: sidebarOpen ? 260 : 68,
        minWidth: sidebarOpen ? 260 : 68,
        display: 'flex', flexDirection: 'column',
        backgroundColor: COLORS.lacivert, color: COLORS.beyazText,
        overflow: 'hidden',
        boxShadow: '4px 0 16px rgba(0,0,0,0.1)',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        zIndex: 20,
      }}>

        {/* Üst: Dinamik Logo Alanı & Toggle */}
        {sidebarOpen ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 12px 10px', height: 60, boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <GaziLogoMark size={34} />
              <div style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', color: COLORS.beyazText, lineHeight: 1.2 }}>
                  GAZİ TEKNOPARK
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', color: COLORS.gaziBordo, lineHeight: 1.2 }}>
                  AI ASİSTAN
                </span>
              </div>
            </div>
            <Tooltip label="Kenar çubuğunu daralt" position="bottom" withArrow openDelay={200}>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 6, borderRadius: 6, color: COLORS.griText, display: 'flex',
                  transition: 'color 0.12s, background 0.12s', flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = COLORS.lacivertHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.griText; e.currentTarget.style.background = 'transparent'; }}
              >
                <PanelLeftClose size={18} />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 60, padding: '10px 0', boxSizing: 'border-box',
          }}>
            <Tooltip label="Kenar çubuğunu aç" position="right" withArrow openDelay={100}>
              <button
                onClick={() => setSidebarOpen(true)}
                onMouseEnter={() => setLogoHovered(true)}
                onMouseLeave={() => setLogoHovered(false)}
                style={{
                  width: 44, height: 44,
                  background: logoHovered ? COLORS.lacivertHover : 'transparent',
                  border: logoHovered ? `1px solid ${COLORS.gaziBordo}` : '1px solid transparent',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  padding: 0,
                }}
              >
                {logoHovered ? (
                  <PanelLeftOpen size={22} color={COLORS.gaziBordo} />
                ) : (
                  <GaziLogoMark size={36} />
                )}
              </button>
            </Tooltip>
          </div>
        )}

        {/* Yeni Sohbet Butonu */}
        <div style={{ padding: sidebarOpen ? '4px 12px 10px' : '4px 0 10px', display: 'flex', justifyContent: 'center' }}>
          {sidebarOpen ? (
            <button
              onClick={handleNewChat}
              onMouseEnter={() => setNewChatHov(true)}
              onMouseLeave={() => setNewChatHov(false)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 14px',
                backgroundColor: newChatHov ? COLORS.lacivertLight : COLORS.lacivertHover,
                color: COLORS.beyazText,
                border: `1px solid ${COLORS.lacivertLight}`,
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              <Plus size={16} />
              Yeni Sohbet
            </button>
          ) : (
            <Tooltip label="Yeni Sohbet" position="right" withArrow openDelay={150}>
              <button
                onClick={handleNewChat}
                onMouseEnter={() => setNewChatHov(true)}
                onMouseLeave={() => setNewChatHov(false)}
                style={{
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: newChatHov ? COLORS.lacivertLight : COLORS.lacivertHover,
                  color: COLORS.beyazText,
                  border: `1px solid ${COLORS.lacivertLight}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Plus size={18} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Navigasyon Öğeleri */}
        <div style={{ padding: sidebarOpen ? '0 8px 4px' : '0 4px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {navItems.map((item) => {
            if (role && !item.roles.includes(role)) return null;
            const active = location.pathname.startsWith(item.path);
            return (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                active={active}
                collapsed={!sidebarOpen}
                onClick={() => navigate(item.path)}
              />
            );
          })}
        </div>

        {/* Ayraç */}
        <div style={{ height: 1, backgroundColor: COLORS.lacivertLight, opacity: 0.5, margin: sidebarOpen ? '6px 12px' : '6px 8px' }} />

        {/* Sohbet Geçmişi */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: sidebarOpen ? '0 6px 12px' : '0 4px 12px' }}>
          {sessions.length === 0 ? (
            sidebarOpen ? (
              <p style={{ fontSize: 12, color: COLORS.griText, padding: '16px 10px', textAlign: 'center', opacity: 0.7 }}>
                Henüz sohbet yok
              </p>
            ) : null
          ) : (
            <>
              {/* Favoriler */}
              {favoriteSessions.length > 0 && (
                <>
                  {sidebarOpen ? (
                    <p style={sectionHeader}>★ Favoriler</p>
                  ) : (
                    <div style={miniDivider} />
                  )}
                  {favoriteSessions.map((s) => (
                    <SidebarSessionItem
                      key={s.id}
                      session={s}
                      isActive={s.id === activeSessionId && isChat}
                      collapsed={!sidebarOpen}
                      onSelect={() => handleSelectSession(s.id)}
                      onFavorite={(e) => { e.stopPropagation(); toggleFavorite(s.id); }}
                      onDelete={(e) => handleDeleteSession(e, s.id)}
                      onRename={(t) => renameSession(s.id, t)}
                    />
                  ))}
                </>
              )}

              {/* Geçmiş Sohbetler */}
              {sidebarOpen ? (
                <p style={sectionHeader}>Sohbetler</p>
              ) : (
                <div style={miniDivider} />
              )}
              {regularSessions.map((s) => (
                <SidebarSessionItem
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId && isChat}
                  collapsed={!sidebarOpen}
                  onSelect={() => handleSelectSession(s.id)}
                  onFavorite={(e) => { e.stopPropagation(); toggleFavorite(s.id); }}
                  onDelete={(e) => handleDeleteSession(e, s.id)}
                  onRename={(t) => renameSession(s.id, t)}
                />
              ))}
            </>
          )}
        </div>

        {/* Alt: Kullanıcı Profili */}
        {sidebarOpen ? (
          <div style={{
            borderTop: `1px solid ${COLORS.lacivertLight}`, padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Avatar size="sm" radius="xl" color="blue" style={{ flexShrink: 0 }}>
              {userInitials}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: COLORS.beyazText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fullName || 'Kullanıcı'}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: COLORS.griText }}>
                {role === 'admin' ? 'Yönetici' : role === 'editor' ? 'Editör' : 'Okuyucu'}
              </p>
            </div>
            <Tooltip label="Çıkış Yap" withArrow position="top">
              <button
                onClick={handleLogout}
                style={{
                  background: 'none', border: 'none', padding: 6,
                  cursor: 'pointer', borderRadius: 6, display: 'flex',
                  color: COLORS.griText, transition: 'color 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b6b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.griText; }}
              >
                <LogOut size={16} />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div style={{
            borderTop: `1px solid ${COLORS.lacivertLight}`, padding: '10px 0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <Tooltip label={`${fullName || 'Kullanıcı'} (${role === 'admin' ? 'Yönetici' : role === 'editor' ? 'Editör' : 'Okuyucu'})`} position="right" withArrow openDelay={150}>
              <Avatar size="sm" radius="xl" color="blue" style={{ flexShrink: 0, cursor: 'pointer' }}>
                {userInitials}
              </Avatar>
            </Tooltip>
            <Tooltip label="Çıkış Yap" position="right" withArrow openDelay={150}>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none', border: 'none', padding: 6,
                  cursor: 'pointer', borderRadius: 6, display: 'flex',
                  color: COLORS.griText, transition: 'color 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b6b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.griText; }}
              >
                <LogOut size={18} />
              </button>
            </Tooltip>
          </div>
        )}
      </aside>

      {/* ── ANA İÇERİK ALANI ── */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          flex: 1, overflow: 'auto',
          padding: isChat ? 0 : 20,
          display: 'flex', flexDirection: 'column',
        }}>
          {children}
        </div>
      </main>
    </div>
  );
};

const sectionHeader: React.CSSProperties = {
  margin: 0, fontSize: 11, fontWeight: 700, color: COLORS.griText,
  padding: '12px 10px 6px', letterSpacing: 0.5, textTransform: 'uppercase',
  opacity: 0.8
};

const miniDivider: React.CSSProperties = {
  height: 1,
  backgroundColor: COLORS.lacivertLight,
  opacity: 0.3,
  margin: '8px 12px',
};

export default AppLayout;
