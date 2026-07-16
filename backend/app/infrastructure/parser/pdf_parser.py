# app/infrastructure/parser/pdf_parser.py
import os
import logging
from typing import List, Dict, Any
from app.application.interfaces.file_parser import IFileParserStrategy

logger = logging.getLogger("app.infrastructure.parser.pdf")

class PDFParserStrategy(IFileParserStrategy):
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dosya bulunamadı: {file_path}")
            
        try:
            import fitz  # PyMuPDF
        except ImportError:
            logger.error("PyMuPDF (fitz) kütüphanesi bulunamadı! 'pip install pymupdf' çalıştırılmalı.")
            raise RuntimeError("PDF okuma kütüphanesi eksik.")

        pages = []
        try:
            doc = fitz.open(file_path)
            for page_idx, page in enumerate(doc):
                text = page.get_text()
                # Sayfa numarası 1-indexed olmalı
                pages.append({
                    "text": text,
                    "page_number": page_idx + 1
                })
            doc.close()
            return pages
        except Exception as e:
            logger.error(f"PDF ayrıştırılırken hata oluştu: {str(e)}")
            raise e
