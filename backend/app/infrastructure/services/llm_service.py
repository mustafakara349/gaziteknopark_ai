# app/infrastructure/services/llm_service.py
import urllib.request
import json
import subprocess
import shutil
import logging
from typing import Generator, List
from llama_index.llms.ollama import Ollama
from app.application.interfaces.llm import ILLMService
from app.core.config import settings

logger = logging.getLogger("app.infrastructure.services.llm_service")

# Varsayılan Sistem Promptları ve Hiperparametreler
DEFAULT_TEMPERATURE = 0.2
DEFAULT_TOP_P = 0.9
DEFAULT_MAX_TOKENS = 2048

DEFAULT_PROMPT_RAG = (
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
    "asla yanıt verme."
)

DEFAULT_PROMPT_CHITCHAT = (
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

DEFAULT_PROMPT_CLASSIFY = (
    "Sen bir sorgu sınıflandırıcısısın. Görevin, kullanıcının yazdığı sorgunun türünü belirlemektir.\n"
    "Sorguyu iki sınıftan birine yerleştir:\n"
    "- CHITCHAT: Selamlaşma, hal hatır sorma, genel sohbet, teşekkür etme, vedalaşma veya asistanın kim olduğunu sorma gibi bilgi aramayan konuşmalar.\n"
    "- RAG: Şirket kuralları, belgeler, teknik konular veya bilgi arama amaçlı sorular/talepler.\n\n"
    "Sorguyu analiz et ve SADECE 'CHITCHAT' veya 'RAG' kelimelerinden birini döndür."
)

class OllamaLLMService(ILLMService):
    def __init__(self):
        self.current_model = settings.LLM_MODEL
        self.temperature = DEFAULT_TEMPERATURE
        self.top_p = DEFAULT_TOP_P
        self.max_tokens = DEFAULT_MAX_TOKENS

        self.prompt_rag = DEFAULT_PROMPT_RAG
        self.prompt_chitchat = DEFAULT_PROMPT_CHITCHAT
        self.prompt_classify = DEFAULT_PROMPT_CLASSIFY

        self._load_settings_from_db()
        self._init_llm()

    def _load_settings_from_db(self):
        try:
            from app.infrastructure.persistence.postgres.database import SessionLocal
            from app.infrastructure.persistence.postgres.models import SystemSettingORM
            db = SessionLocal()
            try:
                setting = db.query(SystemSettingORM).filter(SystemSettingORM.key == "ai_settings").first()
                if setting and isinstance(setting.value, dict):
                    val = setting.value
                    self.temperature = float(val.get("temperature", DEFAULT_TEMPERATURE))
                    self.top_p = float(val.get("top_p", DEFAULT_TOP_P))
                    self.max_tokens = int(val.get("max_tokens", DEFAULT_MAX_TOKENS))
                    self.prompt_rag = val.get("prompt_rag", DEFAULT_PROMPT_RAG)
                    self.prompt_chitchat = val.get("prompt_chitchat", DEFAULT_PROMPT_CHITCHAT)
                    self.prompt_classify = val.get("prompt_classify", DEFAULT_PROMPT_CLASSIFY)
                    if val.get("current_model"):
                        self.current_model = val.get("current_model")
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Veritabanından AI ayarları okunamadı, varsayılanlar kullanılıyor: {str(e)}")

    def _save_settings_to_db(self):
        try:
            from app.infrastructure.persistence.postgres.database import SessionLocal
            from app.infrastructure.persistence.postgres.models import SystemSettingORM
            db = SessionLocal()
            try:
                data = {
                    "temperature": self.temperature,
                    "top_p": self.top_p,
                    "max_tokens": self.max_tokens,
                    "prompt_rag": self.prompt_rag,
                    "prompt_chitchat": self.prompt_chitchat,
                    "prompt_classify": self.prompt_classify,
                    "current_model": self.current_model
                }
                setting = db.query(SystemSettingORM).filter(SystemSettingORM.key == "ai_settings").first()
                if not setting:
                    setting = SystemSettingORM(key="ai_settings", value=data)
                    db.add(setting)
                else:
                    setting.value = data
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Veritabanına AI ayarları kaydedilemedi: {str(e)}")

    def _init_llm(self):
        logger.info(f"Ollama LLM servisi başlatılıyor. Model: {self.current_model}, Temp: {self.temperature}, TopP: {self.top_p}, MaxTokens: {self.max_tokens}")
        self.llm = Ollama(
            model=self.current_model,
            base_url=settings.OLLAMA_URL,
            temperature=self.temperature,
            top_p=self.top_p,
            additional_kwargs={"num_predict": self.max_tokens},
            request_timeout=60.0
        )

    def generate(self, prompt: str) -> str:
        response = self.llm.complete(prompt)
        return str(response).strip()

    def generate_stream(self, prompt: str) -> Generator[str, None, None]:
        response_gen = self.llm.stream_complete(prompt)
        for response_chunk in response_gen:
            yield response_chunk.delta

    def get_current_model(self) -> str:
        return self.current_model

    def set_current_model(self, model_name: str) -> str:
        cleaned_name = model_name.strip()
        if not cleaned_name:
            raise ValueError("Model adı boş olamaz.")
        
        self.current_model = cleaned_name
        settings.LLM_MODEL = cleaned_name
        self._init_llm()
        self._save_settings_to_db()
        logger.info(f"Aktif LLM modeli çalışma zamanında (runtime) değiştirildi: {self.current_model}")
        return self.current_model

    def get_hyperparameters(self) -> dict:
        return {
            "temperature": self.temperature,
            "top_p": self.top_p,
            "max_tokens": self.max_tokens
        }

    def set_hyperparameters(self, temperature: float, top_p: float, max_tokens: int) -> dict:
        self.temperature = float(temperature)
        self.top_p = float(top_p)
        self.max_tokens = int(max_tokens)
        self._init_llm()
        self._save_settings_to_db()
        return self.get_hyperparameters()

    def get_prompts(self) -> dict:
        return {
            "prompt_rag": self.prompt_rag,
            "prompt_chitchat": self.prompt_chitchat,
            "prompt_classify": self.prompt_classify
        }

    def set_prompts(self, prompt_rag: str, prompt_chitchat: str, prompt_classify: str) -> dict:
        if prompt_rag: self.prompt_rag = prompt_rag
        if prompt_chitchat: self.prompt_chitchat = prompt_chitchat
        if prompt_classify: self.prompt_classify = prompt_classify
        self._save_settings_to_db()
        return self.get_prompts()

    def reset_settings_to_defaults(self) -> dict:
        self.temperature = DEFAULT_TEMPERATURE
        self.top_p = DEFAULT_TOP_P
        self.max_tokens = DEFAULT_MAX_TOKENS
        self.prompt_rag = DEFAULT_PROMPT_RAG
        self.prompt_chitchat = DEFAULT_PROMPT_CHITCHAT
        self.prompt_classify = DEFAULT_PROMPT_CLASSIFY
        self._init_llm()
        self._save_settings_to_db()
        return {
            "hyperparameters": self.get_hyperparameters(),
            "prompts": self.get_prompts(),
            "current_model": self.current_model
        }

    def _is_chat_model(self, name: str, details: dict = None) -> bool:
        name_lower = name.lower()
        embedding_keywords = [
            "embed", "bge", "nomic", "minilm", "e5", "bert", 
            "rerank", "vector", "embedding"
        ]
        if any(kw in name_lower for kw in embedding_keywords):
            return False
        
        if details and isinstance(details, dict):
            family = str(details.get("family") or "").lower()
            families = [str(f).lower() for f in details.get("families") or []]
            if "bert" in family or "nomic-embed" in family or any("bert" in f for f in families):
                return False

        return True

    def list_available_models(self) -> List[str]:
        models = []
        
        # 1. Ollama HTTP API /api/tags üzerinden yerel modelleri sorgula
        urls_to_try = [
            f"{settings.OLLAMA_URL.rstrip('/')}/api/tags",
            "http://127.0.0.1:11434/api/tags",
            "http://localhost:11434/api/tags",
            "http://host.docker.internal:11434/api/tags"
        ]
        
        for url in urls_to_try:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "GaziAI/1.0"})
                with urllib.request.urlopen(req, timeout=3) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        for m in data.get("models", []):
                            name = m.get("name") or m.get("model")
                            details = m.get("details")
                            if name and self._is_chat_model(name, details) and name not in models:
                                models.append(name)
                        if models:
                            return models
            except Exception:
                continue

        # 2. Alternatif: CLI subprocess `ollama list` denemesi
        if shutil.which("ollama"):
            try:
                res = subprocess.run(["ollama", "list"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
                if res.returncode == 0:
                    lines = res.stdout.strip().split("\n")
                    for line in lines[1:]:
                        parts = line.split()
                        if parts and parts[0]:
                            model_name = parts[0]
                            if self._is_chat_model(model_name) and model_name not in models:
                                models.append(model_name)
                    if models:
                        return models
            except Exception:
                pass

        # 3. Eğer hiçbir yöntemle sohbet modeli çekilemezse mevcut konfigürasyondaki modeli ekle
        if not models:
            models.append(self.current_model)

        return models
