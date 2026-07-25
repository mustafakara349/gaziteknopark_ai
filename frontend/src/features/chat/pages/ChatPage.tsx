import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { Avatar, Tooltip, LoadingOverlay, Stack, Text, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Send, FileText, MessageSquare, Sparkles, ChevronDown } from 'lucide-react';
import { useChatStore } from '../../../store/chat-store';
import { useAuthStore } from '../../../store/auth-store';
import apiClient from '../../../core/api-client';

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
  const [isMultiLine, setIsMultiLine] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Yanıt Süresi Sayacı (Timer) State'leri
  const [streamTimer, setStreamTimer] = useState<{ isTiming: boolean; elapsed: string }>({
    isTiming: false,
    elapsed: '0.0',
  });
  const [completedDurations, setCompletedDurations] = useState<{ [msgId: string]: string }>({});
  const timerRef = useRef<any>(null);

  // Model Yönetimi State'leri
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [modelLoading, setModelLoading] = useState<boolean>(false);

  // Vektör/Embedding modellerini gizleme filtresi
  const isChatModel = (name: string) => {
    const n = name.toLowerCase();
    const embedKw = ["embed", "bge", "nomic", "minilm", "e5", "bert", "rerank", "vector", "embedding"];
    return !embedKw.some((kw) => n.includes(kw));
  };

  const fetchModels = async () => {
    try {
      const res = await apiClient.get<{ models: string[]; current_model: string }>('/system/models');
      const filtered = (res.data.models || []).filter(isChatModel);
      setAvailableModels(filtered);
      setActiveModel(res.data.current_model || (filtered.length > 0 ? filtered[0] : ''));
    } catch (err) {
      console.error('Modeller çekilemedi:', err);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleModelChange = async (newModel: string) => {
    if (!newModel || newModel === activeModel || modelLoading) return;
    setModelLoading(true);
    try {
      const response = await apiClient.post<{ status: string; current_model: string; message: string }>('/system/models/select', {
        model_name: newModel
      });
      setActiveModel(response.data.current_model);
      notifications.show({
        title: 'Model Değiştirildi',
        message: `Sohbet modeli '${response.data.current_model}' olarak güncellendi.`,
        color: 'green',
        icon: <Sparkles size={16} />,
        autoClose: 2500,
      });
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.response?.data?.detail || 'Model değiştirilemedi.',
        color: 'red',
      });
    } finally {
      setModelLoading(false);
    }
  };

  // Yeni mesaj gelince en alta kaydır
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Textarea dinamik yükseklik ve içerik silindiğinde sıfırlama mantığı
  useLayoutEffect(() => {
    if (!textareaRef.current) {
      setIsMultiLine(false);
      return;
    }

    // İçerik tamamen silindiğinde varsayılan tek satır haline geri döndür
    if (!query.trim()) {
      textareaRef.current.style.height = '24px';
      if (isMultiLine) {
        setIsMultiLine(false);
      }
      return;
    }

    // Önce yüksekliği serbest bırakıp scrollHeight hesapla
    textareaRef.current.style.height = 'auto';
    const sh = textareaRef.current.scrollHeight;

    // Satır kırılması veya genişlik aşımı tespiti
    const newIsMulti = query.includes('\n') || sh > 38;
    if (newIsMulti !== isMultiLine) {
      setIsMultiLine(newIsMulti);
    }

    // Yüksekliği 220px (en az 4-8 satır rahat görünüm) kadar esnet, üstünü scroll yap
    const minH = newIsMulti ? 52 : 24;
    const targetH = Math.max(minH, Math.min(sh, 220));
    textareaRef.current.style.height = `${targetH}px`;
  }, [query, isMultiLine]);

  const handleSend = async () => {
    if (!query.trim() || !activeSessionId || isSending) return;
    const currentQuery = query;
    setQuery('');
    setIsMultiLine(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }
    setIsSending(true);

    // TTFT (Time to First Token) Canlı Sayacı Başlat (0.0 saniye)
    const startTime = Date.now();
    let firstTokenReceived = false;

    setStreamTimer({ isTiming: true, elapsed: '0.0' });

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!firstTokenReceived) {
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        setStreamTimer({ isTiming: true, elapsed: elapsedSec });
      }
    }, 100);

    const freezeTTFTTimer = () => {
      if (!firstTokenReceived) {
        firstTokenReceived = true;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const ttftSec = ((Date.now() - startTime) / 1000).toFixed(1);
        const durationText = `${ttftSec} saniye sürdü`;
        setStreamTimer({ isTiming: false, elapsed: ttftSec });
        setCompletedDurations((prev) => ({
          ...prev,
          ['placeholder-assistant']: durationText,
          ['latest']: durationText
        }));
      }
    };

    try {
      await sendMessageStream(activeSessionId, currentQuery, (token) => {
        // İlk kelime/token ulaştığı anda TTFT sayacını dondur ve sabitle
        if (token && token.trim().length > 0) {
          freezeTTFTTimer();
        }
      });
    } catch (err) {
      console.error('Akış hatası:', err);
    } finally {
      // Akış sonlandığında sayacın durduğundan emin ol
      freezeTTFTTimer();
      setIsSending(false);
    }
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
            {messages.map((msg, index) => {
              const groupedSources = groupSources(msg.sources);
              const isLastAssistant = msg.role === 'assistant' && index === messages.length - 1;
              const isCurrentlyGenerating = isSending && isLastAssistant;

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
                    {/* İsim ve Entegre Sayaç */}
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: '#71717a', marginBottom: 4,
                      paddingLeft: msg.role === 'assistant' ? 2 : 0,
                      paddingRight: msg.role === 'user' ? 2 : 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}>
                      {msg.role === 'user' ? (fullName || 'Siz') : 'Gazi Teknopark AI'}

                      {/* AI Yanıt Süresi Sayacı */}
                      {msg.role === 'assistant' && (
                        <>
                          {isCurrentlyGenerating ? (
                            /* 1. Canlı Çalışan Sayaç (0.0 saniye) */
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              marginLeft: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              color: COLORS.lacivert,
                              backgroundColor: COLORS.acikMavi,
                              padding: '1px 8px',
                              borderRadius: 12,
                              boxShadow: '0 1px 3px rgba(27,54,93,0.08)',
                            }}>
                              <Sparkles size={11} color={COLORS.lacivert} />
                              {streamTimer.elapsed} saniye
                            </span>
                          ) : (completedDurations[msg.id] || (isLastAssistant && completedDurations['latest'])) ? (
                            /* 2. Tamamlanan Yanıt Süresi (Örn: 2.3 saniye sürdü) */
                            <span style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: '#8a94a6',
                              marginLeft: 8,
                            }}>
                              • {completedDurations[msg.id] || (isLastAssistant ? completedDurations['latest'] : '')}
                            </span>
                          ) : null}
                        </>
                      )}
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
            flexDirection: isMultiLine ? 'column' : 'row',
            alignItems: isMultiLine ? 'stretch' : 'center',
            gap: 10,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 24,
            padding: '12px 14px 12px 20px',
            boxShadow: '0 10px 30px -10px rgba(27,54,93,0.12), 0 1px 3px rgba(0,0,0,0.02)',
            transition: 'border-color 0.2s, box-shadow 0.2s, all 0.2s ease',
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
            {/* Dinamik ve 220px (8-9 satır) yüksekliğine kadar otomatik esneyen Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Herhangi bir şey sor"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                resize: 'none',
                fontSize: 14.5,
                lineHeight: 1.6,
                color: '#1c1917',
                fontFamily: 'inherit',
                minHeight: isMultiLine ? 52 : 24,
                maxHeight: 220,
                overflowY: textareaRef.current && textareaRef.current.scrollHeight > 220 ? 'auto' : 'hidden',
                paddingTop: isMultiLine ? 2 : 0,
                display: 'block',
              }}
            />

            {/* Kontrol Alanı (Dropdown & Gönder Butonu) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isMultiLine ? 'flex-end' : 'flex-start',
              gap: 8,
              flexShrink: 0,
              width: isMultiLine ? '100%' : 'auto',
              marginTop: isMultiLine ? 4 : 0,
            }}>
              {/* Minimal Entegre AI Model Seçici */}
              {availableModels.length > 0 && (
                <Select
                  variant="unstyled"
                  data={availableModels}
                  value={activeModel}
                  onChange={(val) => val && handleModelChange(val)}
                  disabled={modelLoading}
                  rightSection={<ChevronDown size={13} color="#71717a" />}
                  rightSectionPointerEvents="none"
                  comboboxProps={{ width: 180, position: 'top-end', shadow: 'md', transitionProps: { transition: 'pop-bottom-right', duration: 150 } }}
                  style={{
                    flexShrink: 0,
                  }}
                  styles={{
                    input: {
                      height: 30,
                      paddingLeft: 10,
                      paddingRight: 24,
                      borderRadius: 15,
                      backgroundColor: '#f4f4f5',
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#3f3f46',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'background-color 0.15s ease',
                      border: 'none',
                      maxWidth: 160,
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    },
                    dropdown: {
                      borderRadius: 12,
                      padding: 4,
                      border: '1px solid #e4e4e7',
                    },
                    option: {
                      fontSize: 12,
                      borderRadius: 8,
                      padding: '6px 10px',
                    }
                  }}
                />
              )}

              {/* Gönder Butonu */}
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
