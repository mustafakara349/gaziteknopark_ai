# app/infrastructure/parser/factory.py
from app.application.interfaces.file_parser import IFileParserStrategy
from app.infrastructure.parser.pdf_parser import PDFParserStrategy
from app.infrastructure.parser.docx_parser import DocxParserStrategy
from app.infrastructure.parser.excel_parser import ExcelParserStrategy
from app.infrastructure.parser.pptx_parser import PptxParserStrategy
from app.infrastructure.parser.txt_parser import TxtParserStrategy

class ParserFactory:
    @staticmethod
    def get_parser(file_type: str) -> IFileParserStrategy:
        """
        Dosya türüne (uzantısına) uygun ayrıştırıcı (parser) stratejisini döner.
        """
        ftype = file_type.lower().strip(".")
        if ftype == "pdf":
            return PDFParserStrategy()
        elif ftype in ("docx", "doc"):
            return DocxParserStrategy()
        elif ftype in ("xlsx", "xls"):
            return ExcelParserStrategy()
        elif ftype in ("pptx", "ppt"):
            return PptxParserStrategy()
        elif ftype == "txt":
            return TxtParserStrategy()
        else:
            raise ValueError(f"Desteklenmeyen dosya türü: {file_type}")
