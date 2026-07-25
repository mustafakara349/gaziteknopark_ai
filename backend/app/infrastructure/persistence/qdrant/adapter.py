# app/infrastructure/persistence/qdrant/adapter.py
import uuid
import logging
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.exceptions import UnexpectedResponse
from app.core.config import settings
from app.domain.repositories.vector_repository import IVectorStoreRepository

logger = logging.getLogger("app.infrastructure.qdrant")

class QdrantVectorRepository(IVectorStoreRepository):
    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL)
        self.collection_name = settings.QDRANT_COLLECTION_NAME
        self._ensure_collection_exists()

    def _ensure_collection_exists(self):
        try:
            # Koleksiyon var mı kontrol et
            self.client.get_collection(self.collection_name)
            logger.info(f"Qdrant koleksiyonu bulundu: {self.collection_name}")
        except (UnexpectedResponse, Exception):
            logger.info(f"Qdrant koleksiyonu bulunamadı, oluşturuluyor: {self.collection_name}")
            try:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=1024, # BGE-M3 embedding boyutu
                        distance=qmodels.Distance.COSINE
                    )
                )
                # Filtreleme performansı için payload indeksleri oluştur
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="document_id",
                    field_schema=qmodels.PayloadSchemaType.KEYWORD
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="collection_id",
                    field_schema=qmodels.PayloadSchemaType.KEYWORD
                )
                logger.info("Qdrant koleksiyonu ve indeksleri başarıyla oluşturuldu.")
            except UnexpectedResponse as ue:
                if getattr(ue, 'status_code', None) == 409 or "already exists" in str(ue):
                    logger.info(f"Qdrant koleksiyonu {self.collection_name} zaten mevcut (409 Conflict).")
                else:
                    logger.error(f"Qdrant koleksiyonu oluşturulurken hata: {str(ue)}")
            except Exception as e:
                logger.error(f"Qdrant koleksiyonu oluşturulurken hata: {str(e)}")

    def search_vectors(
        self,
        query_vector: List[float],
        limit: int = 4,
        collection_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        # Filtreleme kriteri
        qfilter = None
        if collection_id:
            qfilter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="collection_id",
                        match=qmodels.MatchValue(value=collection_id)
                    )
                ]
            )
            
        try:
            if hasattr(self.client, "query_points"):
                response = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    query_filter=qfilter,
                    limit=limit
                )
                results = response.points
            else:
                results = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    query_filter=qfilter,
                    limit=limit
                )
            
            output = []
            for res in results:
                output.append({
                    "chunk_id": res.id,
                    "score": res.score,
                    "payload": res.payload
                })
            return output
        except Exception as e:
            logger.error(f"Qdrant vektör araması hatası: {str(e)}")
            return []

    def insert_vectors(
        self,
        vectors: List[List[float]],
        payloads: List[Dict[str, Any]],
        ids: Optional[List[str]] = None
    ) -> bool:
        try:
            points = []
            for i, vector in enumerate(vectors):
                point_id = ids[i] if ids else str(uuid.uuid4())
                points.append(
                    qmodels.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payloads[i]
                    )
                )
                
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            return True
        except Exception as e:
            logger.error(f"Qdrant vektör ekleme hatası: {str(e)}")
            return False

    def delete_vectors_by_doc_id(self, document_id: str) -> bool:
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qmodels.FilterSelector(
                    filter=qmodels.Filter(
                        must=[
                            qmodels.FieldCondition(
                                key="document_id",
                                match=qmodels.MatchValue(value=document_id)
                            )
                        ]
                    )
                )
            )
            return True
        except Exception as e:
            logger.error(f"Qdrant vektör silme hatası: {str(e)}")
            return False
