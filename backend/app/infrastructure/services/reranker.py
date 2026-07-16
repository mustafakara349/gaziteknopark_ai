# app/infrastructure/services/reranker.py
import logging
from typing import List, Dict, Any
from app.core.config import settings

logger = logging.getLogger("app.infrastructure.reranker")

class BGEReranker:
    def __init__(self):
        self.model_name = settings.RERANKER_MODEL
        self.model = None

    def _load_model(self):
        if self.model is None:
            try:
                from sentence_transformers import CrossEncoder
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
                logger.info(f"Reranker modeli yükleniyor: {self.model_name} (Aygıt: {device})")
                self.model = CrossEncoder(self.model_name, device=device)
            except ImportError:
                logger.error("sentence_transformers veya torch yüklü değil! Reranker bypass edilecek.")
                self.model = "bypass"

    def rerank(self, query: str, chunks: List[Dict[str, Any]], top_n: int = 4) -> List[Dict[str, Any]]:
        self._load_model()
        if not chunks:
            return []
            
        if self.model == "bypass":
            logger.warning("Reranker bypass edildi. Qdrant skorları kullanılacak.")
            # Qdrant'tan gelen sırayı koru, ilk top_n'i al
            for chunk in chunks:
                chunk["rerank_score"] = chunk.get("score", 0.0)
            return chunks[:top_n]
            
        try:
            # Reranker girdilerini hazırlıyoruz: [[query, text1], [query, text2], ...]
            pairs = [[query, chunk["payload"]["text"]] for chunk in chunks]
            
            # Skorları hesapla
            scores = self.model.predict(pairs)
            
            import math
            # Skorları chunk'lara ata
            for idx, score in enumerate(scores):
                # BGE CrossEncoder ham logit (negatif veya pozitif) döner,
                # Bunu olasılığa (0-1) dönüştürmek için Sigmoid fonksiyonu uyguluyoruz.
                logit_score = float(score)
                if logit_score >= 0:
                    sigmoid_score = 1 / (1 + math.exp(-logit_score))
                else:
                    z = math.exp(logit_score)
                    sigmoid_score = z / (1 + z)
                
                chunks[idx]["rerank_score"] = sigmoid_score
                
            # Skorlara göre büyükten küçüğe sırala
            sorted_chunks = sorted(chunks, key=lambda x: x["rerank_score"], reverse=True)
            
            # Sadece Top-N'i döndür
            return sorted_chunks[:top_n]
        except Exception as e:
            logger.error(f"Rerank işlemi sırasında hata: {str(e)}")
            # Hata durumunda Qdrant skorlarını kopyalayarak fallback yap
            for chunk in chunks:
                chunk["rerank_score"] = chunk.get("score", 0.0)
            return chunks[:top_n]
