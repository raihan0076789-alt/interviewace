"""
Resume text extraction using pdfplumber.
pdfplumber handles real-world resume layouts (multi-column, tables)
more reliably than raw PyMuPDF for text extraction purposes.
"""

import io
import logging

import pdfplumber

logger = logging.getLogger(__name__)


class ResumeParseError(Exception):
    pass


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract all text from a PDF given its raw bytes.
    Raises ResumeParseError on any failure — caller converts to HTTP error.
    """
    if not pdf_bytes:
        raise ResumeParseError("Empty PDF file received")

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            if not pdf.pages:
                raise ResumeParseError("PDF has no pages")

            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text and text.strip():
                    pages.append(text.strip())

            if not pages:
                raise ResumeParseError(
                    "No text could be extracted. "
                    "The PDF may be scanned or image-based — please use a text-based PDF."
                )

            full_text = "\n\n".join(pages)
            logger.info("Extracted %d characters from %d pages", len(full_text), len(pages))
            return full_text

    except ResumeParseError:
        raise
    except Exception as exc:
        raise ResumeParseError(f"Failed to parse PDF: {exc}") from exc