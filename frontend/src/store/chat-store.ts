import { create } from 'zustand';
import apiClient from '../core/api-client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: Array<any>;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  collection_id: string | null;
  is_favorite: boolean;
  created_at: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  fetchSessions: () => Promise<void>;
  createSession: (title: string, collectionId?: string | null) => Promise<string>;
  selectSession: (sessionId: string) => Promise<void>;
  sendMessageStream: (sessionId: string, query: string, onToken: (token: string) => void) => Promise<void>;
  toggleFavorite: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  loading: false,

  fetchSessions: async () => {
    try {
      const response = await apiClient.get<ChatSession[]>('/chat/sessions');
      set({ sessions: response.data });
    } catch (error) {
      console.error('Sohbet oturumları çekilemedi', error);
    }
  },

  createSession: async (title, collectionId = null) => {
    try {
      const response = await apiClient.post<ChatSession>('/chat/sessions', {
        title,
        collection_id: collectionId,
      });
      const newSession = response.data;
      set((state) => ({ sessions: [newSession, ...state.sessions], activeSessionId: newSession.id, messages: [] }));
      return newSession.id;
    } catch (error) {
      console.error('Oturum oluşturulamadı', error);
      throw error;
    }
  },

  selectSession: async (sessionId) => {
    set({ activeSessionId: sessionId, loading: true });
    try {
      const response = await apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
      set({ messages: response.data, loading: false });
    } catch (error) {
      console.error('Sohbet geçmişi çekilemedi', error);
      set({ loading: false });
    }
  },

  sendMessageStream: async (sessionId, query, onToken) => {
    // 1. Ekran arayüzüne hemen kullanıcı mesajını ekle (Optimistic UI)
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: query,
      sources: [],
      created_at: new Date().toISOString(),
    };
    
    // Placeholder asistan mesajı oluştur
    const assistantMsgPlaceholderId = 'placeholder-assistant';
    const assistantMsg: ChatMessage = {
      id: assistantMsgPlaceholderId,
      role: 'assistant',
      content: '',
      sources: [],
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMsg, assistantMsg],
    }));

    try {
      const token = localStorage.getItem('access_token');
      // Server-Sent Events (SSE) akışını okumak için native EventSource yerine fetch kullanıyoruz
      // çünkü Custom header (Authorization Bearer) eklemek EventSource'da zordur.
      const response = await fetch(`/api/v1/chat/sessions/${sessionId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let assistantText = '';
      let isSourcesEvent = false;
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // SSE formatında gelen satırları ayrıştır: "event: sources" ve "data: token\n\n"
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('event: sources')) {
            isSourcesEvent = true;
          } else if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (isSourcesEvent) {
              try {
                const sources = JSON.parse(dataStr);
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === assistantMsgPlaceholderId ? { ...m, sources } : m
                  ),
                }));
              } catch (e) {
                console.error("Kaynak parse hatası:", e);
              }
              isSourcesEvent = false;
            } else {
              assistantText += dataStr;
              onToken(dataStr);
              
              // Asistan mesajını sürekli güncelle
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === assistantMsgPlaceholderId ? { ...m, content: assistantText } : m
                ),
              }));
            }
          }
        }
      }
      
      // Akış bittikten sonra gerçek mesajları DB'den tazelemek için oturumu tekrar çekebiliriz
      const messagesRes = await apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
      set({ messages: messagesRes.data });
      get().fetchSessions(); // Oturum başlık güncellemesi için (Celery arka planda bitmiş olabilir)
    } catch (error) {
      console.error('Mesaj gönderim hatası', error);
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantMsgPlaceholderId
            ? { ...m, content: 'Mesaj iletilemedi. Lütfen bağlantınızı kontrol edin.' }
            : m
        ),
      }));
    }
  },

  toggleFavorite: async (sessionId) => {
    try {
      const response = await apiClient.post<ChatSession>(`/chat/sessions/${sessionId}/favorite`);
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? response.data : s)),
      }));
    } catch (error) {
      console.error('Favori güncelleme hatası', error);
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await apiClient.delete(`/chat/sessions/${sessionId}`);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        messages: state.activeSessionId === sessionId ? [] : state.messages,
      }));
    } catch (error) {
      console.error('Sohbet silme hatası', error);
    }
  },

  renameSession: async (sessionId, newTitle) => {
    try {
      const response = await apiClient.patch<ChatSession>(`/chat/sessions/${sessionId}`, { title: newTitle });
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? response.data : s)),
      }));
    } catch (error) {
      console.error('Sohbet yeniden adlandırma hatası', error);
    }
  },
}));
