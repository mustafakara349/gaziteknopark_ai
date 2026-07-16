import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar, Tooltip } from '@mantine/core';
import {
  MessageSquare, FileText, LayoutDashboard, Database,
  LogOut, Plus, PanelLeftClose, PanelLeft,
  Pencil, Trash2, Check, X, Star
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { useChatStore } from '../../store/chat-store';

/* ─────────────────────────────────────────────
   Gazi Üniversitesi Kurumsal Renkleri (Pantone)
   ─────────────────────────────────────────────
   Pantone 534C (Lacivert): #1b365d (Ana Arka Plan)
   Pantone 7457C (Açık Mavi): #e6f0fa (Detay/Aktif yazılar)
   Pantone 871C (Gold/Altın): #c5a059 (Favori vb.)
   Pantone 221C (Bordo/Kırmızı): #8f0037 (Sil/Çıkış)
*/

const COLORS = {
  lacivert: '#1b365d',
  lacivertHover: '#224472',
  lacivertLight: '#2c4e7e',
  acikMavi: '#e6f0fa',
  gold: '#c5a059',
  bordo: '#8f0037',
  griText: '#9ab2cf',
  beyazText: '#ffffff'
};

/* ─────────────────────────────────────────────
   Sidebar Sohbet Öğesi
   ───────────────────────────────────────────── */
interface SidebarSessionItemProps {
  session: { id: string; title: string; is_favorite: boolean };
  isActive: boolean;
  onSelect: () => void;
  onFavorite: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (newTitle: string) => void;
}

const SidebarSessionItem: React.FC<SidebarSessionItemProps> = ({
  session, isActive, onSelect, onFavorite, onDelete, onRename,
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
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 10px', borderRadius: 8,
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? COLORS.beyazText : '#cfdbe9',
        backgroundColor: active ? COLORS.lacivertLight : hov ? COLORS.lacivertHover : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <Icon size={16} color={active ? COLORS.beyazText : COLORS.griText} />
      {label}
    </button>
  );
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

  useEffect(() => { fetchSessions(); }, []);

  const isChat = location.pathname === '/chat';

  /* Sidebar işlemleri */
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

  /* Navigasyon öğeleri */
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

  const [newChatHov, setNewChatHov] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>

      {/* ── SIDEBAR (Gazi Üniversitesi Laciverti) ── */}
      {sidebarOpen && (
        <aside style={{
          width: 260, minWidth: 260,
          display: 'flex', flexDirection: 'column',
          backgroundColor: COLORS.lacivert, color: COLORS.beyazText,
          overflow: 'hidden',
          boxShadow: '4px 0 16px rgba(0,0,0,0.1)'
        }}>
          {/* Üst: Toggle butonu */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            padding: '14px 12px 6px',
          }}>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 6, borderRadius: 6, color: COLORS.griText, display: 'flex',
                transition: 'color 0.12s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.griText; }}
              title="Kenar çubuğunu kapat"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          {/* Yeni Sohbet Butonu (Gösterge panelinin üstünde) */}
          <div style={{ padding: '4px 12px 10px' }}>
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
          </div>

          {/* Navigasyon Öğeleri */}
          <div style={{ padding: '0 8px 4px' }}>
            {navItems.map((item) => {
              if (role && !item.roles.includes(role)) return null;
              const active = location.pathname.startsWith(item.path);
              return (
                <NavItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  active={active}
                  onClick={() => navigate(item.path)}
                />
              );
            })}
          </div>

          {/* Ayraç */}
          <div style={{ height: 1, backgroundColor: COLORS.lacivertLight, opacity: 0.5, margin: '6px 12px' }} />

          {/* Sohbet Geçmişi */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 12px' }}>
            {sessions.length === 0 ? (
              <p style={{ fontSize: 12, color: COLORS.griText, padding: '16px 10px', textAlign: 'center', opacity: 0.7 }}>
                Henüz sohbet yok
              </p>
            ) : (
              <>
                {/* Favoriler */}
                {favoriteSessions.length > 0 && (
                  <>
                    <p style={sectionHeader}>★ Favoriler</p>
                    {favoriteSessions.map((s) => (
                      <SidebarSessionItem
                        key={s.id}
                        session={s}
                        isActive={s.id === activeSessionId && isChat}
                        onSelect={() => handleSelectSession(s.id)}
                        onFavorite={(e) => { e.stopPropagation(); toggleFavorite(s.id); }}
                        onDelete={(e) => handleDeleteSession(e, s.id)}
                        onRename={(t) => renameSession(s.id, t)}
                      />
                    ))}
                  </>
                )}

                {/* Geçmiş Sohbetler */}
                <p style={sectionHeader}>Sohbetler</p>
                {regularSessions.map((s) => (
                  <SidebarSessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId && isChat}
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
        </aside>
      )}

      {/* ── ANA İÇERİK ALANI ── */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Sidebar kapalıyken aç düğmesi */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: 'absolute', top: 14, left: 14, zIndex: 50,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 6, display: 'flex',
              color: COLORS.lacivert,
            }}
            title="Kenar çubuğunu aç"
          >
            <PanelLeft size={20} />
          </button>
        )}

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

export default AppLayout;
