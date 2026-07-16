import React, { useEffect, useState, useRef } from 'react';
import { Avatar, Tooltip, LoadingOverlay, Stack, Text } from '@mantine/core';
import { Send, FileText, MessageSquare, Sparkles } from 'lucide-react';
import { useChatStore } from '../../../store/chat-store';
import { useAuthStore } from '../../../store/auth-store';

/* ─────────────────────────────────────────────
   Gazi Üniversitesi Kurumsal Renkleri (Pantone)
   ───────────────────────────────────────────── */
const COLORS = {
  lacivert: '#1b365d',
  lacivertHover: '#224472',
  lacivertLight: '#2c4e7e',
  acikMavi: '#eef5fc',
  acikMaviHover: '#dce8f5',
  gold: '#c5a059',
  bordo: '#8f0037',
  griText: '#5f6368',
  koyuText: '#18181b',
  beyazText: '#ffffff'
};

/* ─────────────────────────────────────────────
   Yardımcı: Kullanıcı baş harfleri
   ───────────────────────────────────────────── */
const initials = (name: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : 'U';

/* ─────────────────────────────────────────────
   Ana Sohbet Sayfası
   ───────────────────────────────────────────── */
export const ChatPage: React.FC = () => {
  const {
    activeSessionId, messages, loading,
    sendMessageStream,
  } = useChatStore();
  const { fullName } = useAuthStore();

  const [query, setQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Yeni mesaj gelince en alta kaydır
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Textarea otomatik yükseklik
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [query]);

  const handleSend = async () => {
    if (!query.trim() || !activeSessionId || isSending) return;
    const currentQuery = query;
    setQuery('');
    setIsSending(true);
    await sendMessageStream(activeSessionId, currentQuery, () => { });
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ─────────────────────────────────────────────
     Kaynak Dosyaları Gruplayan Yardımcı Fonksiyon
     ───────────────────────────────────────────── */
  const groupSources = (sources: any[]) => {
    if (!sources || sources.length === 0) return [];
    const groups: { [key: string]: { file_name: string; pages: number[]; scores: number[] } } = {};
    
    sources.forEach(src => {
      const name = src.file_name || 'Bilinmeyen Belge';
      if (!groups[name]) {
        groups[name] = {
          file_name: name,
          pages: [],
          scores: []
        };
      }
      if (src.page_number !== undefined && src.page_number !== null) {
        if (!groups[name].pages.includes(src.page_number)) {
          groups[name].pages.push(src.page_number);
        }
      }
      if (src.score !== undefined && src.score !== null) {
        groups[name].scores.push(src.score);
      }
    });

    return Object.values(groups).map(g => {
      g.pages.sort((a, b) => a - b);
      const maxScore = g.scores.length > 0 ? Math.max(...g.scores) : 0;
      return {
        file_name: g.file_name,
        pages: g.pages,
        score: maxScore
      };
    });
  };

  const userInitials = initials(fullName);

  /* ── Sohbet seçilmediyse: Karşılama ekranı ── */
  if (!activeSessionId) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#ffffff', height: '100%',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `linear-gradient(135deg, ${COLORS.lacivert} 0%, ${COLORS.lacivertHover} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 4px 16px rgba(27,54,93,0.2)',
        }}>
          <Sparkles size={26} color="#fff" />
        </div>
        <Text size="xl" fw={700} c="dark.5" mb={4}>
          Sen hazır olduğunda hazırım.
        </Text>
        <Text size="sm" c="dimmed" style={{ maxWidth: 380, textAlign: 'center', lineHeight: 1.7 }}>
          Sol panelden bir sohbet seçin ya da <strong>Yeni Sohbet</strong> butonuyla yeni
          sohbet başlatarak teknopark hakkında sorularınızı sorun.
        </Text>
      </div>
    );
  }

  /* ── Aktif sohbet ekranı ── */
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden', backgroundColor: '#fff',
    }}>
      {/* Mesaj Alanı — sadece burası scroll edilir */}
      <div style={{
        flex: 1, overflowY: 'auto', position: 'relative',
      }}>
        <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 1 }} />

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 24px' }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                backgroundColor: COLORS.acikMavi, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <MessageSquare size={24} color={COLORS.lacivert} />
              </div>
              <Text fw={600} size="md" c="dark.4">Sohbet henüz başlamadı.</Text>
              <Text size="sm" c="dimmed" mt={6} style={{ maxWidth: 340, margin: '8px auto 0', lineHeight: 1.6 }}>
                Teknopark hakkında herhangi bir şey sorabilirsiniz.
              </Text>
            </div>
          )}

          <Stack gap={24}>
            {messages.map((msg) => {
              const groupedSources = groupSources(msg.sources);
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex', gap: 12,
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Avatar */}
                  <Avatar
                    color={msg.role === 'user' ? 'dark' : 'blue'}
                    radius="xl"
                    size={30}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  >
                    {msg.role === 'user' ? userInitials : 'GT'}
                  </Avatar>

                  {/* Mesaj içerik bloğu */}
                  <div style={{
                    maxWidth: '80%', display: 'flex', flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    {/* İsim */}
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: '#71717a', marginBottom: 4,
                      paddingLeft: msg.role === 'assistant' ? 2 : 0,
                      paddingRight: msg.role === 'user' ? 2 : 0,
                    }}>
                      {msg.role === 'user' ? (fullName || 'Siz') : 'Gazi Teknopark AI'}
                    </span>

                    {/* Balon */}
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: msg.role === 'user'
                        ? '18px 18px 4px 18px'
                        : '18px 18px 18px 4px',
                      backgroundColor: msg.role === 'user' ? COLORS.lacivert : COLORS.acikMavi,
                      color: msg.role === 'user' ? COLORS.beyazText : COLORS.koyuText,
                      fontSize: 14, lineHeight: 1.7,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      boxShadow: msg.role === 'user'
                        ? '0 1px 6px rgba(27,54,93,0.2)'
                        : '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                      {msg.content ? (
                        msg.content
                      ) : (
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      )}
                    </div>

                    {/* Kaynaklar — balonun hemen altında */}
                    {msg.role === 'assistant' && groupedSources.length > 0 && (
                      <div style={{
                        marginTop: 8, display: 'flex', flexWrap: 'wrap',
                        gap: 5, alignItems: 'center', paddingLeft: 2,
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#8a94a6', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                          Kaynaklar:
                        </span>
                        {groupedSources.map((src, sidx) => {
                          const pagesStr = src.pages.length > 0 ? ` (s. ${src.pages.join(', ')})` : '';
                          return (
                            <Tooltip
                              key={sidx}
                              label={`En yüksek alaka: ${(src.score * 100).toFixed(0)}%`}
                              withArrow color="dark" openDelay={200}
                            >
                              <span
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '3px 10px', backgroundColor: '#f0f4f8',
                                  border: '1px solid #dbe3eb', borderRadius: 20,
                                  fontSize: 11, fontWeight: 500, color: COLORS.lacivert,
                                  cursor: 'help', transition: 'all 0.12s', whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = COLORS.acikMaviHover;
                                  e.currentTarget.style.borderColor = '#b9cde3';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f0f4f8';
                                  e.currentTarget.style.borderColor = '#dbe3eb';
                                }}
                              >
                                <FileText size={10} color={COLORS.lacivert} />
                                {src.file_name}
                                {pagesStr}
                              </span>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </Stack>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Sabit Alt Modern/Yüzen Input Alanı ── */}
      <div style={{
        flexShrink: 0,
        backgroundColor: 'transparent',
        padding: '0 24px 20px',
        backgroundImage: 'linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0) 100%)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 24,
            padding: '12px 14px 12px 20px',
            boxShadow: '0 10px 30px -10px rgba(27,54,93,0.12), 0 1px 3px rgba(0,0,0,0.02)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = COLORS.lacivert;
              e.currentTarget.style.boxShadow = `0 10px 30px -10px rgba(27,54,93,0.2), 0 0 0 2px rgba(27,54,93,0.15)`;
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(27,54,93,0.12), 0 1px 3px rgba(0,0,0,0.02)';
              }
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Herhangi bir şey sor"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                resize: 'none',
                fontSize: 14.5,
                lineHeight: 1.6,
                color: '#1c1917',
                fontFamily: 'inherit',
                maxHeight: 160,
                overflowY: 'auto',
                paddingTop: 3,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!query.trim() || isSending}
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: query.trim() && !isSending ? COLORS.lacivert : '#f4f4f5',
                color: query.trim() && !isSending ? '#ffffff' : '#a1a1aa',
                cursor: query.trim() && !isSending ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (query.trim() && !isSending) {
                  e.currentTarget.style.backgroundColor = COLORS.lacivertHover;
                }
              }}
              onMouseLeave={(e) => {
                if (query.trim() && !isSending) {
                  e.currentTarget.style.backgroundColor = COLORS.lacivert;
                }
              }}
            >
              <Send size={15} />
            </button>
          </div>
          <p style={{
            fontSize: 11, color: '#a1a1aa', textAlign: 'center',
            margin: '10px 0 0', lineHeight: 1.4,
          }}>
            Yanıtlar yüklenmiş belgeler temel alınarak üretilmektedir. Yapay zeka hata yapabilir. Önemli bilgileri kontrol edin
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
