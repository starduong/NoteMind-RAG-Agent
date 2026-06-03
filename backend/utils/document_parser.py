import os
from typing import Tuple
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings
from unstructured.partition.auto import partition
import trafilatura
from bs4 import BeautifulSoup
from utils.logger import parser_logger

# Initialize embedding model for semantic chunking
EMBEDDING_MODEL = "BAAI/bge-m3"
embeddings = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL,
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)

# Initialize semantic chunker
text_splitter = SemanticChunker(embeddings=embeddings, breakpoint_threshold_amount=0.85)


def extract_text_with_unstructured(file_path: str) -> str:
    """
    Extract text from PDF, DOCX, or TXT file using Unstructured.io

    Args:
        file_path: Path to file

    Returns:
        Extracted text content
    """
    parser_logger.info(f"Extracting text with Unstructured.io: {file_path}")
    text = ""
    try:
        # Use unstructured to partition the document
        elements = partition(filename=file_path)

        # Extract text from elements
        extracted_texts = []
        for element in elements:
            if hasattr(element, "text") and element.text.strip():
                extracted_texts.append(element.text)

        text = "\n\n".join(extracted_texts)
        parser_logger.info(
            f"Unstructured.io extraction complete: {len(text)} total characters"
        )

    except Exception as e:
        parser_logger.error(f"Error extracting with Unstructured.io: {str(e)}")
        raise ValueError(f"Error extracting file with Unstructured.io: {str(e)}")

    return text


def extract_text_with_trafilatura(file_path: str) -> str:
    """
    Extract text from HTML file using Trafilatura

    Args:
        file_path: Path to HTML file

    Returns:
        Extracted text content
    """
    parser_logger.info(f"Extracting text with Trafilatura: {file_path}")
    text = ""
    try:
        # Read HTML file
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            html_content = f.read()

        parser_logger.debug(f"HTML file size: {len(html_content)} characters")

        # Extract text using trafilatura
        extracted = trafilatura.extract(
            html_content,
            include_comments=False,
            include_tables=True,
            include_links=False,
            include_images=False,
            include_formatting=True,
        )

        if extracted:
            text = extracted
            parser_logger.info(
                f"Trafilatura extraction complete: {len(text)} total characters"
            )
        else:
            parser_logger.warning(
                "Trafilatura returned no content, falling back to BeautifulSoup"
            )
            # Fallback to BeautifulSoup if trafilatura fails
            soup = BeautifulSoup(html_content, "lxml")

            # Remove script and style elements
            for script in soup(["script", "style", "meta", "link"]):
                script.decompose()

            # Get text
            text = soup.get_text(separator="\n", strip=True)

            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = "\n".join(chunk for chunk in chunks if chunk)

            parser_logger.info(
                f"BeautifulSoup fallback complete: {len(text)} total characters"
            )

    except Exception as e:
        parser_logger.error(f"Error extracting with Trafilatura: {str(e)}")
        raise ValueError(f"Error extracting HTML with Trafilatura: {str(e)}")

    return text


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from PDF file using Unstructured.io

    Args:
        file_path: Path to PDF file

    Returns:
        Extracted text content
    """
    parser_logger.info(f"Extracting text from PDF: {file_path}")
    return extract_text_with_unstructured(file_path)


def extract_text_from_docx(file_path: str) -> str:
    """
    Extract text from DOCX file using Unstructured.io

    Args:
        file_path: Path to DOCX file

    Returns:
        Extracted text content
    """
    parser_logger.info(f"Extracting text from DOCX: {file_path}")
    return extract_text_with_unstructured(file_path)


def extract_text_from_txt(file_path: str) -> str:
    """
    Extract text from TXT file using Unstructured.io

    Args:
        file_path: Path to TXT file

    Returns:
        Extracted text content
    """
    parser_logger.info(f"Extracting text from TXT: {file_path}")
    return extract_text_with_unstructured(file_path)


def extract_text_from_html(file_path: str) -> str:
    """
    Extract text from HTML file using Trafilatura

    Args:
        file_path: Path to HTML file

    Returns:
        Extracted text content
    """
    parser_logger.info(f"Extracting text from HTML: {file_path}")
    return extract_text_with_trafilatura(file_path)


def extract_text_from_file(file_path: str) -> Tuple[str, str]:
    """
    Extract text from any supported file format
    Automatically detects format based on file extension

    Supported formats:
    - PDF (.pdf) - using Unstructured.io
    - DOCX (.docx) - using Unstructured.io
    - HTML (.html, .htm) - using Trafilatura
    - TXT (.txt) - using Unstructured.io

    Args:
        file_path: Path to file

    Returns:
        Tuple of (extracted_text, file_type)

    Raises:
        ValueError: If file format is not supported or extraction fails
    """
    # Get file extension
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    parser_logger.info(f"Processing file: {file_path} (extension: {ext})")

    # Map extensions to parsers
    parsers = {
        ".pdf": (extract_text_from_pdf, "PDF"),
        ".docx": (extract_text_from_docx, "DOCX"),
        ".html": (extract_text_from_html, "HTML"),
        ".htm": (extract_text_from_html, "HTML"),
        ".txt": (extract_text_from_txt, "TXT"),
    }

    if ext not in parsers:
        supported = ", ".join(parsers.keys())
        parser_logger.warning(f"Unsupported file format: {ext}")
        raise ValueError(
            f"Unsupported file format: {ext}. Supported formats: {supported}"
        )

    # Extract text using appropriate parser
    parser_func, file_type = parsers[ext]
    parser_logger.debug(f"Using parser for {file_type}")
    text = parser_func(file_path)

    if not text or len(text.strip()) < 10:
        parser_logger.warning(f"No meaningful text extracted from {file_type} file")
        raise ValueError(f"No meaningful text extracted from {file_type} file")

    parser_logger.info(
        f"File processed successfully: {file_type}, {len(text)} characters"
    )
    return text, file_type


def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> list[str]:
    """
    Split text into overlapping chunks using semantic chunking

    Args:
        text: Text to chunk
        chunk_size: Kept for backward compatibility but not used in semantic chunking
        overlap: Kept for backward compatibility but not used in semantic chunking

    Returns:
        List of text chunks using semantic boundaries
    """
    if not text:
        parser_logger.warning("Empty text provided for chunking")
        return []

    parser_logger.debug(f"Applying semantic chunking to text of length: {len(text)}")

    try:
        # Use semantic chunker
        chunks = text_splitter.split_text(text)

        # Filter out empty chunks
        chunks = [chunk.strip() for chunk in chunks if chunk.strip()]

        parser_logger.info(f"Text chunked semantically into {len(chunks)} chunks")

        # Log chunk size statistics
        if chunks:
            avg_size = sum(len(chunk) for chunk in chunks) / len(chunks)
            min_size = min(len(chunk) for chunk in chunks)
            max_size = max(len(chunk) for chunk in chunks)
            parser_logger.debug(
                f"Chunk statistics - Avg: {avg_size:.0f}, Min: {min_size}, Max: {max_size}"
            )

    except Exception as e:
        parser_logger.error(f"Error during semantic chunking: {str(e)}")
        parser_logger.warning("Falling back to fixed-size chunking")

        # Fallback to fixed-size chunking if semantic chunking fails
        fallback_chunk_size = chunk_size if chunk_size else 500
        fallback_overlap = overlap if overlap else 50

        chunks = []
        start = 0
        text_length = len(text)

        while start < text_length:
            end = start + fallback_chunk_size
            chunk = text[start:end]

            if chunk.strip():
                chunks.append(chunk)

            start += fallback_chunk_size - fallback_overlap

        parser_logger.info(f"Fallback chunking produced {len(chunks)} chunks")

    return chunks


# Supported file extensions
SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".html", ".htm", ".txt"]
SUPPORTED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/html",
    "text/plain",
]
