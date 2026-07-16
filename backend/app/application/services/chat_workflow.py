# app/application/services/chat_workflow.py
import logging
from typing import List, Dict, Any, TypedDict, Optional
from app.application.interfaces.llm import ILLMService
from app.application.interfaces.embedding import IEmbeddingService

from app.core.config import settings
from app.domain.repositories.vector_repository import IVectorStoreRepository
from app.infrastructure.services.reranker import BGEReranker
from app.infrastructure.services.redis_cache import RedisCacheService

logger = logging.getLogger("app.application.services.chat_workflow")

# LangGraph Eşdeğer Durum Şeması
class AgentState(TypedDict):
    query: str
    session_id: str
    collection_id: Optional[str]
    raw_chunks: List[Dict[str, Any]]
    reranked_chunks: List[Dict[str, Any]]
    response: str
    sources: List[Dict[str, Any]]
    is_safe: bool
    cached_response: Optional[str]
    query_type: str
    chat_history: List[Dict[str, str]]

class ChatWorkflow:
    def __init__(
        self,
        vector_repo: IVectorStoreRepository,
        reranker: BGEReranker,
        redis_cache: RedisCacheService,
        llm_service: ILLMService,
        embedding_service: IEmbeddingService
    ):
        self.vector_repo = vector_repo
        self.reranker = reranker
        self.redis_cache = redis_cache
        self.llm_service = llm_service
        self.embedding_service = embedding_service
        
        # LangGraph Workflow Derlemesi (Tembel veya direkt)
        self._setup_workflow()

    def _setup_workflow(self):
        try:
            from langgraph.graph import StateGraph, END
            
            workflow = StateGraph(AgentState)
            
            # Düğümleri (Nodes) ekle
            workflow.add_node("guardrail", self.guardrail_node)
            workflow.add_node("classify", self.classify_node)
            workflow.add_node("generate_chitchat", self.generate_chitchat_node)
            workflow.add_node("check_cache", self.check_cache_node)
            workflow.add_node("retrieve", self.retrieve_node)
            workflow.add_node("rerank", self.rerank_node)
            workflow.add_node("llm_gen", self.llm_gen_node)
            workflow.add_node("hallucination_grader", self.hallucination_grader_node)
            workflow.add_node("empty_response", self.empty_response_node)
            workflow.add_node("blocked_response", self.blocked_response_node)
            workflow.add_node("final_response", self.final_response_node)
            
            # Başlangıç noktasını belirle
            workflow.set_entry_point("guardrail")
            
            # Kenarları (Edges) bağla
            workflow.add_conditional_edges(
                "guardrail",
                self.decide_safety,
                {
                    "safe": "classify",
                    "unsafe": "blocked_response"
                }
            )
            
            workflow.add_conditional_edges(
                "classify",
                self.route_query_type,
                {
                    "chitchat": "generate_chitchat",
                    "rag": "check_cache"
                }
            )
            
            workflow.add_conditional_edges(
                "check_cache",
                self.decide_cache,
                {
                    "hit": "final_response",
                    "miss": "retrieve"
                }
            )
            
            workflow.add_edge("generate_chitchat", END)
            workflow.add_edge("retrieve", "rerank")
            
            workflow.add_conditional_edges(
                "rerank",
                self.decide_rerank,
                {
                    "has_context": "llm_gen",
                    "no_context": "empty_response"
                }
            )
            
            workflow.add_conditional_edges(
                "llm_gen",
                self.decide_hallucination,
                {
                    "grounded": "final_response",
                    "hallucinated": "empty_response"
                }
            )
            
            workflow.add_edge("blocked_response", END)
            workflow.add_edge("empty_response", END)
            workflow.add_edge("final_response", END)
            
            self.graph = workflow.compile()
            self.use_langgraph = True
            logger.info("LangGraph workflow başarıyla derlendi.")
        except ImportError:
            logger.warning("langgraph kütüphanesi bulunamadı. Yerel durum makinesi (Pure Python State Machine) kullanılacak.")
            self.use_langgraph = False

    # DÜĞÜM (NODE) İMPLEMENTASYONLARI
    
    def guardrail_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Zararlı girdileri (Prompt Injection) denetler.
        """
        query = state["query"].lower()
        # Basit prompt injection saldırı kalıpları denetimi
        injection_keywords = ["ignore previous instructions", "system prompt", "yeni rolün", "sistem kurallarını unut"]
        is_safe = not any(kw in query for kw in injection_keywords)
        return {"is_safe": is_safe}

    def route_query_type(self, state: AgentState) -> str:
        return state.get("query_type", "rag")

    def classify_node(self, state: AgentState) -> Dict[str, Any]:
        """Kullanıcı niyetini sınıflandırır."""
        query = state["query"]
        clean_query = query.strip().lower().rstrip("?.! ")
        chitchat_keywords = {
            "selam", "merhaba", "merhabâ", "nasılsın", "günaydın", "tünaydın", 
            "iyi günler", "iyi akşamlar", "iyi geceler", "hey", "hi", "hello",
            "teşekkür", "teşekkürler", "sağol", "sağ olasın", "teşekkür ederim",
            "hoşça kal", "görüşürüz", "bye", "selamlar", "nasılsınız", "kimsin",
            "sen kimsin", "adın ne", "ne yaparsın", "kolay gelsin", "merhabalar",
            "slm", "mrb", "nbr", "ne haber", "naber"
        }
        if clean_query in chitchat_keywords:
            return {"query_type": "chitchat"}
            
        words = clean_query.split()
        if len(words) <= 2:
            greeting_roots = {"selam", "merhaba", "nasılsın", "günaydın", "teşekkür", "sağol", "hey", "hi", "hello", "nbr", "slm", "mrb"}
            if any(any(root in word for root in greeting_roots) for word in words):
                return {"query_type": "chitchat"}
        
        system_prompt = (
            "Sen bir sorgu sınıflandırıcısısın. Görevin, kullanıcının yazdığı sorgunun türünü belirlemektir.\n"
            "Sorguyu iki sınıftan birine yerleştir:\n"
            "- CHITCHAT: Selamlaşma, hal hatır sorma, genel sohbet, teşekkür etme, vedalaşma veya asistanın kim olduğunu sorma gibi bilgi aramayan konuşmalar.\n"
            "- RAG: Şirket kuralları, belgeler, teknik konular veya bilgi arama amaçlı sorular/talepler.\n\n"
            "Sorguyu analiz et ve SADECE 'CHITCHAT' veya 'RAG' kelimelerinden birini döndür."
        )
        try:
            response = self.llm_service.generate(f"{system_prompt}\nSORGULA: {query}")
            classification = response.upper()
            if "CHITCHAT" in classification:
                return {"query_type": "chitchat"}
        except Exception:
            pass
        return {"query_type": "rag"}

    def generate_chitchat_node(self, state: AgentState) -> Dict[str, Any]:
        """Sıradan sohbete yanıt üretir."""
        query = state["query"]
        history_parts = []
        for msg in state.get("chat_history", []):
            role_label = "Kullanıcı" if msg.get("role") == "user" else "Asistan"
            history_parts.append(f"{role_label}: {msg.get('content')}")
        history_str = "\n".join(history_parts)
        
        system_prompt = (
            "Sen 'Gazi Teknopark' (Gazi Üniversitesi Teknoloji Geliştirme Bölgesi) için özel olarak geliştirilmiş, "
            "resmi, güvenilir ve son derece profesyonel bir Kurumsal Bilgi Asistanısın.\n"
            "Şu anki görevin, kullanıcının selamlaşma, hal hatır sorma veya genel sohbet amaçlı iletilerine "
            "Gazi Teknopark'ın kurumsal kimliğine yakışır şekilde, nazik, sıcak ve profesyonel bir karşılık vermektir.\n\n"
            "KURALLAR:\n"
            "1. KİMLİĞİNİ KORU: Sen bir yapay zeka asistanısın. Kendini 'Gazi Teknopark Kurumsal Bilgi Asistanı' olarak tanıt.\n"
            "2. YARDIMA HAZIR OL: Kullanıcıya hal hatır sorduktan veya selamını aldıktan sonra, Gazi Teknopark "
            "kuralları, mevzuatları, hizmetleri veya genel belgeleri hakkında sorular sorabileceğini hatırlat.\n"
            "3. KISA VE ÖZ: Yanıtlarını çok uzatmadan, doğrudan, sıcak ve kurumsal bir tonda tut.\n"
            "4. KURUMSALLIK: Asla argo, aşırı laubali veya profesyonellik dışı kelimeler kullanma."
        )
        prompt = f"{system_prompt}\n\n"
        if history_str:
            prompt += f"SOHBET GEÇMİŞİ:\n{history_str}\n\n"
        prompt += f"Kullanıcı: {query}\nAsistan:"
        
        try:
            response = self.llm_service.generate(prompt)
            return {"response": response, "sources": []}
        except Exception as e:
            logger.error(f"Chitchat oluşturma hatası: {str(e)}")
            return {"response": "Merhaba, size nasıl yardımcı olabilirim?", "sources": []}

    def check_cache_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Redis üzerinde semantik cache sorgusu gerçekleştirir.
        """
        # Geliştirme aşaması için basit cache araması (İleride Redis Vektör Arama olarak geliştirilebilir)
        # Şimdilik birebir veya çok yakın anahtar eşleşmesi kontrol ediliyor
        query = state["query"].strip()
        cache_key = f"semantic_cache:{query}"
        cached = self.redis_cache.get(cache_key)
        return {"cached_response": cached}

    def retrieve_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Qdrant üzerinden en benzer 20 chunk'ı çeker.
        """
        try:
            # Sorunun embedding'ini al
            query_vector = self.embedding_service.get_text_embedding(state["query"])
            
            # Vektör araması yap
            raw_chunks = self.vector_repo.search_vectors(
                query_vector=query_vector,
                limit=20,
                collection_id=state["collection_id"]
            )
            return {"raw_chunks": raw_chunks}
        except Exception as e:
            logger.error(f"RetrieveNode hatası: {str(e)}")
            return {"raw_chunks": []}

    def rerank_node(self, state: AgentState) -> Dict[str, Any]:
        """
        BGE Reranker ile adayları değerlendirip top-4'e indirger.
        """
        raw_chunks = state.get("raw_chunks", [])
        if not raw_chunks:
            return {"reranked_chunks": []}
            
        # Reranker servisini çağır
        reranked = self.reranker.rerank(
            query=state["query"],
            chunks=raw_chunks,
            top_n=4
        )
        return {"reranked_chunks": reranked}

    def llm_gen_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Ollama yerel modeline prompt göndererek yanıt üretir.
        """
        chunks = state.get("reranked_chunks", [])
        
        # Bağlam metnini birleştir
        context_list = []
        sources = []
        for idx, chunk in enumerate(chunks):
            payload = chunk["payload"]
            context_list.append(f"Kaynak {idx+1} [Belge: {payload['file_name']}, Sayfa: {payload['page_number']}]:\n{payload['text']}")
            sources.append({
                "file_name": payload["file_name"],
                "page_number": payload["page_number"],
                "score": chunk.get("rerank_score", 0.0)
            })
            
        context_str = "\n\n".join(context_list)
        
        system_prompt = (
            "Sen 'Gazi Teknopark' (Gazi Üniversitesi Teknoloji Geliştirme Bölgesi) için özel olarak geliştirilmiş, "
            "resmi, güvenilir ve son derece profesyonel bir Kurumsal Bilgi Asistanısın.\n"
            "Görevin, Gazi Teknopark firmaları, çalışanları, yönetimi veya dış paydaşları tarafından sorulan sorulara "
            "aşağıda sağlanan 'Kaynak Belgeler' (Context) ışığında en doğru, şeffaf ve kurumsal dilde yanıt vermektir.\n\n"
            "KESİN KURALLAR VE DAVRANIŞ BİÇİMİ:\n"
            "1. SADECE KAYNAK KULLANIMI: Yanıtlarını oluştururken SADECE sana sağlanan 'Kaynak Belgeler' içerisindeki bilgileri kullan. "
            "Asla kendi genel bilginle varsayımda bulunma, tahminde bulunma veya dışarıdan bilgi uydurma (Halüsinasyon yapma).\n"
            "2. BİLGİ EKSİKLİĞİ: Eğer kullanıcının sorusunun cevabı sağlanan kaynak belgelerde kesin olarak yer almıyorsa, "
            "SADECE VE SADECE \"Kaynak belgelerde bu bilgiye ulaşılamadı.\" yanıtını ver. Başka hiçbir açıklama, yorum veya ek cümle ekleme.\n"
            "3. DİL VE ÜSLUP: Her zaman saygılı, resmi, empatik ve çözüm odaklı bir dil kullan. Yanıtlarını "
            "okunması kolay olacak şekilde paragraflara ve (gerekirse) maddelere bölerek yapılandır.\n"
            "4. BAĞLAM (CONTEXT) BÜTÜNLÜĞÜ: Cevabın, soruyu doğrudan yanıtlamalı, gereksiz laf kalabalığından kaçınmalı "
            "ancak yeterince açıklayıcı ve doyurucu olmalıdır.\n"
            "5. GİZLİLİK VE GÜVENLİK: Gazi Teknopark'ın kurumsal itibarını koru. Yasaklı, yasadışı veya zararlı içeriklere "
            "asla yanıt verme.\n\n"
            f"--- KAYNAK BELGELER BAŞLANGICI ---\n{context_str}\n--- KAYNAK BELGELER BİTİŞİ ---\n"
        )
        
        # Sohbet geçmişini ekle
        history_parts = []
        for msg in state.get("chat_history", []):
            role_label = "Kullanıcı" if msg.get("role") == "user" else "Asistan"
            history_parts.append(f"{role_label}: {msg.get('content')}")
        history_str = "\n".join(history_parts)

        prompt = ""
        if history_str:
            prompt += f"SOHBET GEÇMİŞİ:\n{history_str}\n\n"
        prompt += f"{system_prompt}\n\nSoru: {state['query']}\nCevap:"
        
        try:
            # LLM'i çağır (Streaming olmayan normal akışta)
            # API katmanında streaming için direkt bu sınıf metotları sarmalanacaktır
            response = self.llm_service.generate(prompt)
            return {"response": response, "sources": sources}
        except Exception as e:
            logger.error(f"LLMGenNode hatası: {str(e)}")
            return {"response": "Kaynak belgelerde bu bilgiye ulaşılamadı.", "sources": []}

    def hallucination_grader_node(self, state: AgentState) -> Dict[str, Any]:
        """
        LLM'in ürettiği yanıtın kaynak bağlamda yer alıp almadığını doğrular.
        Eğer halüsinasyon varsa yanıt boş kabul edilir.
        """
        response = state.get("response", "")
        chunks = state.get("reranked_chunks", [])
        
        # Basit Kural Tabanlı Halüsinasyon Kontrolü:
        # Eğer LLM " ulaşılamadı", "bilgi bulunamadı" veya "yanıt veremediği" vb. ifadeler kullandıysa kabul et.
        if any(keyword in response.lower() for keyword in ["ulaşılamadı", "bulunamadı", "yanıt veremediği", "cevap veremiyoruz", "bilgi yer almıyor"]):
            return {"response": "Kaynak belgelerde bu bilgiye ulaşılamadı."}
            
        # Diğer durumlarda, üretilen yanıt kelimelerinin anlamsal olarak kaynak metinlerde geçip geçmediğine bakılır
        # (İleri seviyede küçük bir NLI modeli veya LLM-as-a-judge eklenebilir)
        # Geliştirme aşaması için basit anahtar kelime eşleşmesi / kapsama denetimi
        context_text = " ".join([c["payload"]["text"].lower() for c in chunks])
        response_lower = response.lower()
        
        # Eğer yanıttaki kritik kelimelerin çoğu bağlamda yoksa halüsinasyon sayabiliriz.
        # Bu aşamada basit kural: Yanıt boş değilse ve bağlam varsa kabul et.
        if chunks and not context_text:
            return {"response": "Kaynak belgelerde bu bilgiye ulaşılamadı."}
            
        return {"response": response}

    def empty_response_node(self, state: AgentState) -> Dict[str, Any]:
        return {
            "response": "Kaynak belgelerde bu bilgiye ulaşılamadı.",
            "sources": []
        }

    def blocked_response_node(self, state: AgentState) -> Dict[str, Any]:
        return {
            "response": "Zararlı veya geçersiz istek algılandı.",
            "sources": []
        }

    def final_response_node(self, state: AgentState) -> Dict[str, Any]:
        # Eğer cache hit ise cache'deki cevabı yükle
        if state.get("cached_response"):
            return {
                "response": state["cached_response"],
                "sources": []
            }
        return {}

    # KARAR EDGE'LERİ (DECISION FUNCTIONS)
    
    def decide_safety(self, state: AgentState) -> str:
        return "safe" if state.get("is_safe", True) else "unsafe"

    def decide_cache(self, state: AgentState) -> str:
        return "hit" if state.get("cached_response") else "miss"

    def decide_rerank(self, state: AgentState) -> str:
        chunks = state.get("reranked_chunks", [])
        if not chunks:
            return "no_context"
            
        # Sigmoid dönüşümü uygulanmış skorlarda (0-1) eşik değeri 0.35 olarak belirlenmiştir.
        best_score = chunks[0].get("rerank_score", 0.0)
        
        if best_score < 0.35:
            logger.info(f"En iyi chunk skoru yeterli değil ({best_score} < 0.35). LLM pas geçiliyor.")
            return "no_context"
            
        return "has_context"

    def decide_hallucination(self, state: AgentState) -> str:
        response = state.get("response", "").lower()
        if any(kw in response for kw in ["ulaşılamadı", "bulunamadı", "yanıt veremediği", "cevap veremiyoruz", "bilgi yer almıyor"]):
            return "hallucinated"
        return "grounded"

    # EXECUTION RUNNER (FALLBACK DESTEKLİ)
    
    def _condense_query(self, query: str, chat_history: List[Dict[str, str]]) -> str:
        """
        Sohbet geçmişine dayanarak yarım veya bağlam gerektiren soruları
        anlamlı ve bağımsız (standalone) bir arama sorgusu haline getirir.
        """
        history_parts = []
        for msg in chat_history:
            role_label = "Kullanıcı" if msg.get("role") == "user" else "Asistan"
            history_parts.append(f"{role_label}: {msg.get('content')}")
        history_str = "\n".join(history_parts)

        system_prompt = (
            "Sen bir arama sorgusu sadeleştirici ve bağlam entegratörüsün.\n"
            "Görevin, verilen sohbet geçmişini ve kullanıcının en son yazdığı soruyu analiz ederek, "
            "en son soruyu geçmiş bağlamını koruyacak şekilde bağımsız (standalone) bir arama sorgusu olarak yeniden yazmaktır.\n\n"
            "KURALLAR:\n"
            "1. Yeniden yazılmış soru, geçmişteki zamirleri (o, bunu, orada vb.) veya gizli özneleri gerçek isimleriyle (Örn: 'stopaj teşviki') değiştirmelidir.\n"
            "2. Eğer son mesaj zaten kendi başına tam ve anlaşılır bir soruysa (örneğin 'merhaba', 'nasılsın' veya "
            "konuyu zaten tamamen açıklayan bağımsız bir soruysa), hiçbir değişiklik yapmadan orijinal soruyu aynen döndür.\n"
            "3. Sadece yeniden yazılmış soruyu döndür. Başına veya sonuna açıklama, yorum veya ek kelime ekleme."
        )
        
        prompt = f"Sohbet Geçmişi:\n{history_str}\n\nEn Son Soru: {query}\nYeniden Yazılmış Soru:"
        try:
            condensed = self.llm_service.generate(prompt, system_prompt=system_prompt)
            condensed_clean = condensed.strip()
            if condensed_clean:
                logger.info(f"Query Condensation: '{query}' -> '{condensed_clean}'")
                return condensed_clean
        except Exception as e:
            logger.error(f"Sorgu sadeleştirme hatası: {str(e)}")
        return query

    def run(self, query: str, chat_history: List[Dict[str, str]] = None, collection_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Durum makinesini çalıştırır. LangGraph yüklü ise grafiği, değilse
        saf Python simülasyonunu yürüterek aynı sonucu verir.
        """
        condensed_query = query
        if chat_history:
            condensed_query = self._condense_query(query, chat_history)

        initial_state: AgentState = {
            "query": condensed_query,
            "session_id": "",
            "collection_id": collection_id,
            "raw_chunks": [],
            "reranked_chunks": [],
            "response": "",
            "sources": [],
            "is_safe": True,
            "cached_response": None,
            "query_type": "",
            "chat_history": chat_history or []
        }
        
        if self.use_langgraph:
            try:
                final_state = self.graph.invoke(initial_state)
                return {
                    "response": final_state["response"],
                    "sources": final_state["sources"]
                }
            except Exception as e:
                logger.error(f"LangGraph çalıştırma hatası: {str(e)}. Fallback yapılıyor...")
                
        # Pure Python State Machine Fallback
        state = initial_state
        
        # 1. Guardrail
        res = self.guardrail_node(state)
        state.update(res)
        if self.decide_safety(state) == "unsafe":
            return self.blocked_response_node(state)
            
        # 2. Classify
        res = self.classify_node(state)
        state.update(res)
        if self.route_query_type(state) == "chitchat":
            res = self.generate_chitchat_node(state)
            state.update(res)
            return {
                "response": state["response"],
                "sources": state["sources"]
            }
            
        # 3. Check Cache
        res = self.check_cache_node(state)
        state.update(res)
        if self.decide_cache(state) == "hit":
            return self.final_response_node(state)
            
        # 3. Retrieve
        res = self.retrieve_node(state)
        state.update(res)
        
        # 4. Rerank
        res = self.rerank_node(state)
        state.update(res)
        if self.decide_rerank(state) == "no_context":
            return self.empty_response_node(state)
            
        # 5. LLM Gen
        res = self.llm_gen_node(state)
        state.update(res)
        if self.decide_hallucination(state) == "hallucinated":
            return self.empty_response_node(state)
            
        # 6. Hallucination Grader
        res = self.hallucination_grader_node(state)
        state.update(res)
        
        # Cache'e yaz
        if state["response"] and "ulaşılamadı" not in state["response"]:
            cache_key = f"semantic_cache:{query.strip()}"
            self.redis_cache.set(cache_key, state["response"], expire_seconds=60*60*24) # 1 gün geçerli
            
        return {
            "response": state["response"],
            "sources": state["sources"]
        }

    def stream_run(self, query: str, chat_history: List[Dict[str, str]] = None, collection_id: Optional[str] = None):
        """
        Durum makinesini çalıştırır ve LLM çıktısını token bazlı stream eder (yield).
        """
        condensed_query = query
        if chat_history:
            condensed_query = self._condense_query(query, chat_history)

        state = {
            "query": condensed_query,
            "session_id": "",
            "collection_id": collection_id,
            "raw_chunks": [],
            "reranked_chunks": [],
            "response": "",
            "sources": [],
            "is_safe": True,
            "cached_response": None,
            "query_type": "",
            "chat_history": chat_history or []
        }
        
        # 1. Guardrail
        res = self.guardrail_node(state)
        state.update(res)
        if not state["is_safe"]:
            yield "Zararlı veya geçersiz istek algılandı."
            return
            
        # 2. Classify
        res = self.classify_node(state)
        state.update(res)
        if self.route_query_type(state) == "chitchat":
            # Chitchat için streaming response oluştur (manuel stream)
            query_val = state["query"]
            history_parts = []
            for msg in state.get("chat_history", []):
                role_label = "Kullanıcı" if msg.get("role") == "user" else "Asistan"
                history_parts.append(f"{role_label}: {msg.get('content')}")
            history_str = "\n".join(history_parts)
            
            system_prompt = (
                "Sen 'Gazi Teknopark' (Gazi Üniversitesi Teknoloji Geliştirme Bölgesi) için özel olarak geliştirilmiş, "
                "resmi, güvenilir ve son derece profesyonel bir Kurumsal Bilgi Asistanısın.\n"
                "Şu anki görevin, kullanıcının selamlaşma, hal hatır sorma veya genel sohbet amaçlı iletilerine "
                "Gazi Teknopark'ın kurumsal kimliğine yakışır şekilde, nazik, sıcak ve profesyonel bir karşılık vermektir.\n\n"
                "KURALLAR:\n"
                "1. KİMLİĞİNİ KORU: Sen bir yapay zeka asistanısın. Kendini 'Gazi Teknopark Kurumsal Bilgi Asistanı' olarak tanıt.\n"
                "2. YARDIMA HAZIR OL: Kullanıcıya hal hatır sorduktan veya selamını aldıktan sonra, Gazi Teknopark "
                "kuralları, mevzuatları, hizmetleri veya genel belgeleri hakkında sorular sorabileceğini hatırlat.\n"
                "3. KISA VE ÖZ: Yanıtlarını çok uzatmadan, doğrudan, sıcak ve kurumsal bir tonda tut.\n"
                "4. KURUMSALLIK: Asla argo, aşırı laubali veya profesyonellik dışı kelimeler kullanma."
            )
            prompt = f"{system_prompt}\n\n"
            if history_str:
                prompt += f"SOHBET GEÇMİŞİ:\n{history_str}\n\n"
            prompt += f"Kullanıcı: {query_val}\nAsistan:"
            
            try:
                response_gen = self.llm_service.generate_stream(prompt)
                for token in response_gen:
                    yield token
            except Exception as e:
                logger.error(f"Chitchat streaming hatası: {str(e)}")
                yield "Merhaba, size nasıl yardımcı olabilirim?"
            return
            
        # 3. Check Cache
        res = self.check_cache_node(state)
        state.update(res)
        if state["cached_response"]:
            yield state["cached_response"]
            return
            
        # 3. Retrieve & Rerank
        res = self.retrieve_node(state)
        state.update(res)
        res = self.rerank_node(state)
        state.update(res)
        
        if self.decide_rerank(state) == "no_context":
            yield "Kaynak belgelerde bu bilgiye ulaşılamadı."
            return
            
        # 4. Prompt hazırlama
        chunks = state["reranked_chunks"]
        context_list = []
        sources = []
        for idx, chunk in enumerate(chunks):
            payload = chunk["payload"]
            context_list.append(f"Kaynak {idx+1} [Belge: {payload['file_name']}, Sayfa: {payload['page_number']}]:\n{payload['text']}")
            sources.append({
                "file_name": payload["file_name"],
                "page_number": payload["page_number"],
                "score": chunk.get("rerank_score", 0.0)
            })
            
        self.last_sources = sources
        context_str = "\n\n".join(context_list)
        system_prompt = (
            "Sen 'Gazi Teknopark' (Gazi Üniversitesi Teknoloji Geliştirme Bölgesi) için özel olarak geliştirilmiş, "
            "resmi, güvenilir ve son derece profesyonel bir Kurumsal Bilgi Asistanısın.\n"
            "Görevin, Gazi Teknopark firmaları, çalışanları, yönetimi veya dış paydaşları tarafından sorulan sorulara "
            "aşağıda sağlanan 'Kaynak Belgeler' (Context) ışığında en doğru, şeffaf ve kurumsal dilde yanıt vermektir.\n\n"
            "KESİN KURALLAR VE DAVRANIŞ BİÇİMİ:\n"
            "1. SADECE KAYNAK KULLANIMI: Yanıtlarını oluştururken SADECE sana sağlanan 'Kaynak Belgeler' içerisindeki bilgileri kullan. "
            "Asla kendi genel bilginle varsayımda bulunma, tahminde bulunma veya dışarıdan bilgi uydurma (Halüsinasyon yapma).\n"
            "2. BİLGİ EKSİKLİĞİ: Eğer kullanıcının sorusunun cevabı sağlanan kaynak belgelerde kesin olarak yer almıyorsa, "
            "SADECE VE SADECE \"Kaynak belgelerde bu bilgiye ulaşılamadı.\" yanıtını ver. Başka hiçbir açıklama, yorum veya ek cümle ekleme.\n"
            "3. DİL VE ÜSLUP: Her zaman saygılı, resmi, empatik ve çözüm odaklı bir dil kullan. Yanıtlarını "
            "okunması kolay olacak şekilde paragraflara ve (gerekirse) maddelere bölerek yapılandır.\n"
            "4. BAĞLAM (CONTEXT) BÜTÜNLÜĞÜ: Cevabın, soruyu doğrudan yanıtlamalı, gereksiz laf kalabalığından kaçınmalı "
            "ancak yeterince açıklayıcı ve doyurucu olmalıdır.\n"
            "5. GİZLİLİK VE GÜVENLİK: Gazi Teknopark'ın kurumsal itibarını koru. Yasaklı, yasadışı veya zararlı içeriklere "
            "asla yanıt verme.\n\n"
            f"--- KAYNAK BELGELER BAŞLANGICI ---\n{context_str}\n--- KAYNAK BELGELER BİTİŞİ ---\n"
        )
        
        # Sohbet geçmişini ekle
        history_parts = []
        for msg in state.get("chat_history", []):
            role_label = "Kullanıcı" if msg.get("role") == "user" else "Asistan"
            history_parts.append(f"{role_label}: {msg.get('content')}")
        history_str = "\n".join(history_parts)

        prompt = ""
        if history_str:
            prompt += f"SOHBET GEÇMİŞİ:\n{history_str}\n\n"
        prompt += f"{system_prompt}\n\nSoru: {state['query']}\nCevap:"
        
        # 5. Stream LLM Response
        try:
            response_gen = self.llm_service.generate_stream(prompt)
            full_response = ""
            for token in response_gen:
                full_response += token
                yield token
                
            # Basit cache kaydetme
            if full_response and "ulaşılamadı" not in full_response:
                cache_key = f"semantic_cache:{query.strip()}"
                self.redis_cache.set(cache_key, full_response, expire_seconds=60*60*24)
        except Exception as e:
            logger.error(f"Streaming LLM hatası: {str(e)}")
            yield "Kaynak belgelerde bu bilgiye ulaşılamadı."

