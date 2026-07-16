# app/application/services/document_processor.py
import logging
from typing import List, Dict, Any
from llama_index.core.node_parser import SentenceSplitter
from app.application.interfaces.embedding import IEmbeddingService

from app.domain.models.document import DocumentStatus, Document
from app.domain.repositories.document_repository import IDocumentRepository
from app.domain.repositories.vector_repository import IVectorStoreRepository
from app.infrastructure.parser.factory import ParserFactory
from app.core.config import settings

logger = logging.getLogger("app.application.services.document_processor")

class DocumentProcessor:
    def __init__(
        self,
        doc_repo: IDocumentRepository,
        vector_repo: IVectorStoreRepository,
        embedding_service: IEmbeddingService
    ):
        self.doc_repo = doc_repo
        self.vector_repo = vector_repo
        self.embedding_service = embedding_service
        self.splitter = SentenceSplitter(
            chunk_size=512,
            chunk_overlap=50
        )

    def process(self, document_id: str) -> None:
        # 1. PostgreSQL'den Belgeyi Çek
        document: Document = self.doc_repo.get_by_id(document_id)
        if not document:
            logger.error(f"Belge veritabanında bulunamadı! ID: {document_id}")
            raise ValueError(f"Belge bulunamadı: {document_id}")
            
        logger.info(f"Belge işleniyor: {document.title} (Yol: {document.file_path})")
        
        # Durumu PROCESSING olarak güncelle
        document.mark_as_processing()
        self.doc_repo.save(document)
        
        try:
            # 2. Uygun Parser'ı Al ve Ayrıştır (Parsing)
            parser = ParserFactory.get_parser(document.file_type)
            pages = parser.parse(document.file_path)
            
            all_chunks_text = []
            all_payloads = []
            
            # 3. Sayfa Sayfa Parçala (Chunking)
            for page in pages:
                text_content = page["text"]
                page_num = page["page_number"]
                
                if not text_content.strip():
                    continue
                    
                # LlamaIndex splitter ile parçala
                chunks = self.splitter.split_text(text_content)
                
                for chunk_idx, chunk_text in enumerate(chunks):
                    all_chunks_text.append(chunk_text)
                    
                    # Metadata hazırlığı
                    payload = {
                        "document_id": str(document.id),
                        "collection_id": str(document.collection_id) if document.collection_id else "",
                        "file_name": document.title,
                        "page_number": page_num,
                        "chunk_index": chunk_idx,
                        "text": chunk_text
                    }
                    all_payloads.append(payload)
                    
            if not all_chunks_text:
                logger.warning(f"Belgeden anlamlı metin çıkarılamadı: {document.title}")
                document.mark_as_completed()
                self.doc_repo.save(document)
                return

            # 4. Batch Embedding Üret
            logger.info(f"Toplam {len(all_chunks_text)} adet chunk için embedding üretiliyor...")
            vectors = []
            
            # Ollama embedding isteklerini batch halinde gönderelim (veya sırayla)
            # Ollama class embedding'leri get_text_embedding_batch ile çekebiliriz
            # Büyük belgelerde bellek taşmasını önlemek için küçük paketler (batch size = 16) halinde işleyelim
            batch_size = 16
            for idx in range(0, len(all_chunks_text), batch_size):
                batch_texts = all_chunks_text[idx : idx + batch_size]
                # LlamaIndex get_text_embedding_batch asenkron olmayan senaryoda çağrılabilir
                batch_vectors = self.embedding_service.get_text_embeddings(batch_texts)
                vectors.extend(batch_vectors)
                
            # 5. Qdrant Vektör Tabanına Kaydet
            logger.info(f"Vektörler Qdrant veritabanına yazılıyor. Koleksiyon: {settings.QDRANT_COLLECTION_NAME}")
            success = self.vector_repo.insert_vectors(
                vectors=vectors,
                payloads=all_payloads
            )
            
            if not success:
                raise RuntimeError("Vektörler Qdrant veritabanına kaydedilemedi.")
                
            # 6. Durumu COMPLETED Olarak Güncelle
            document.mark_as_completed()
            # Dinamik metadata'yı güncelleyebiliriz
            document.metadata["total_chunks"] = len(all_chunks_text)
            self.doc_repo.save(document)
            
            logger.info(f"Belge başarıyla Qdrant ve PostgreSQL tarafında indekslendi: {document.title}")
            
        except Exception as e:
            logger.error(f"Belge işlenirken hata oluştu! Hata: {str(e)}")
            document.mark_as_failed(str(e))
            self.doc_repo.save(document)
            raise e
