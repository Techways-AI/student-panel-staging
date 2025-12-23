import re
import json
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

def auto_chunk_text(text: str, max_chunk_size: int = 1200, chunk_overlap: int = 200) -> List[str]:
    """
    Intelligent text chunking that preserves semantic structure.
    
    Args:
        text: Input text to chunk
        max_chunk_size: Maximum size of each chunk
        chunk_overlap: Overlap between chunks to avoid boundary truncation
    
    Returns:
        List of text chunks
    """
    if not text or len(text) <= max_chunk_size:
        return [text] if text else []
    
    chunks = []
    paragraphs = text.split('\n\n')
    current_chunk = ""
    
    for paragraph in paragraphs:
        # Never discard small blocks (tables/formulas)
        if len(paragraph.strip()) < 50:
            # Add small blocks to current chunk
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph
        else:
            # Check if adding this paragraph would exceed chunk size
            test_chunk = current_chunk + "\n\n" + paragraph if current_chunk else paragraph
            
            if len(test_chunk) <= max_chunk_size:
                current_chunk = test_chunk
            else:
                # Current chunk is full, save it
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                # Start new chunk with overlap
                if chunks and chunk_overlap > 0:
                    # Get last part of previous chunk for overlap
                    last_chunk = chunks[-1]
                    overlap_text = last_chunk[-chunk_overlap:] if len(last_chunk) > chunk_overlap else last_chunk
                    current_chunk = overlap_text + "\n\n" + paragraph
                else:
                    current_chunk = paragraph
    
    # Add the last chunk
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks

def get_chunk_metadata(chunk_text: str, source: str) -> Dict:
    """
    Extract enhanced metadata from text chunk.
    
    Args:
        chunk_text: The text chunk
        source: Source document information
    
    Returns:
        Dictionary containing metadata
    """
    metadata = {
        "source": source,
        "chunk_length": len(chunk_text),
        "word_count": len(chunk_text.split()),
        "has_table": False,
        "has_header": False,
        "has_formula": False,
        "has_calculation": False,
        "semantic_class": "general"
    }
    
    # Detect tables (pipe format or structured data)
    if '|' in chunk_text and chunk_text.count('|') > 5:
        metadata["has_table"] = True
        metadata["semantic_class"] = "table"
    
    # Detect headers (short lines, all caps, or numbered)
    lines = chunk_text.split('\n')
    for line in lines[:3]:  # Check first few lines
        line = line.strip()
        if (len(line) < 100 and 
            (line.isupper() or 
             re.match(r'^\d+\.', line) or 
             re.match(r'^[IVX]+\.', line))):
            metadata["has_header"] = True
            break
    
    # Detect chemical formulas
    if re.search(r'[A-Z][a-z]?\d*', chunk_text):
        metadata["has_formula"] = True
        metadata["semantic_class"] = "chemical"
    
    # Detect calculations
    if re.search(r'[\+\-\*\/\=\^]', chunk_text) and re.search(r'\d+', chunk_text):
        metadata["has_calculation"] = True
        metadata["semantic_class"] = "calculation"
    
    # Detect specific pharmacy/medical content
    medical_terms = [
        'pharmacokinetics', 'pharmacodynamics', 'dosage', 'administration',
        'contraindications', 'side effects', 'drug interaction', 'metabolism',
        'excretion', 'half-life', 'bioavailability', 'therapeutic index'
    ]
    
    chunk_lower = chunk_text.lower()
    medical_term_count = sum(1 for term in medical_terms if term in chunk_lower)
    
    if medical_term_count >= 2:
        metadata["semantic_class"] = "medical"
    elif medical_term_count == 1:
        metadata["semantic_class"] = "pharmacy_related"
    
    return metadata

def extract_structured_content(text: str) -> Dict:
    """
    Extract structured content like tables, lists, and formulas.
    
    Args:
        text: Input text
    
    Returns:
        Dictionary with structured content
    """
    structured = {
        "tables": [],
        "lists": [],
        "formulas": [],
        "calculations": []
    }
    
    lines = text.split('\n')
    
    # Extract tables
    table_lines = []
    in_table = False
    
    for line in lines:
        if '|' in line and line.count('|') >= 2:
            if not in_table:
                in_table = True
            table_lines.append(line)
        elif in_table:
            if table_lines:
                structured["tables"].append('\n'.join(table_lines))
            table_lines = []
            in_table = False
    
    if table_lines:
        structured["tables"].append('\n'.join(table_lines))
    
    # Extract lists
    list_patterns = [
        r'^\d+\.\s',  # Numbered lists
        r'^[a-z]\)\s',  # Lettered lists
        r'^[\-\*]\s',  # Bullet points
        r'^[IVX]+\.\s'  # Roman numerals
    ]
    
    for line in lines:
        for pattern in list_patterns:
            if re.match(pattern, line):
                structured["lists"].append(line)
                break
    
    # Extract formulas and calculations
    formula_patterns = [
        r'[A-Z][a-z]?\d*',  # Chemical formulas
        r'[\+\-\*\/\=\^]\s*\d+',  # Mathematical operations
        r'pH\s*=\s*',  # pH calculations
        r'log\s*\(',  # Logarithmic functions
    ]
    
    for line in lines:
        for pattern in formula_patterns:
            if re.search(pattern, line):
                if any(op in line for op in ['+', '-', '*', '/', '=']):
                    structured["calculations"].append(line)
                else:
                    structured["formulas"].append(line)
                break
    
    return structured

def clean_text(text: str) -> str:
    """
    Clean and normalize text.
    
    Args:
        text: Raw text
    
    Returns:
        Cleaned text
    """
    if not text:
        return ""
    
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Remove special characters that might interfere with processing
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    # Normalize line breaks
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Remove empty lines
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    text = '\n'.join(lines)
    
    return text.strip()

def extract_keywords(text: str, max_keywords: int = 10) -> List[str]:
    """
    Extract important keywords from text.
    
    Args:
        text: Input text
        max_keywords: Maximum number of keywords to extract
    
    Returns:
        List of keywords
    """
    # Common stop words
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    }
    
    # Extract words
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    
    # Filter out stop words and count frequency
    word_freq = {}
    for word in words:
        if word not in stop_words:
            word_freq[word] = word_freq.get(word, 0) + 1
    
    # Sort by frequency and return top keywords
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, freq in sorted_words[:max_keywords]]

def detect_language(text: str) -> str:
    """
    Simple language detection.
    
    Args:
        text: Input text
    
    Returns:
        Language code ('en', 'es', 'fr', etc.)
    """
    # This is a simple implementation
    # In production, you might want to use a proper language detection library
    
    # Check for common English words
    english_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'}
    words = set(re.findall(r'\b[a-zA-Z]+\b', text.lower()))
    
    if words.intersection(english_words):
        return 'en'
    
    # Add more language detection logic as needed
    return 'en'  # Default to English

def format_chemical_formula(formula: str) -> str:
    """
    Format chemical formula with proper tags.
    
    Args:
        formula: Chemical formula string
    
    Returns:
        Formatted formula with tags
    """
    # Simple formatting - in production you might want more sophisticated parsing
    if re.match(r'^[A-Z][a-z]?\d*$', formula):
        return f"<chem>{formula}</chem>"
    return formula

def format_molecular_structure(structure: str) -> str:
    """
    Format molecular structure with proper tags.
    
    Args:
        structure: Molecular structure string
    
    Returns:
        Formatted structure with tags
    """
    return f"<mol>{structure}</mol>"

def format_calculation(calc: str) -> str:
    """
    Format calculation with proper tags.
    
    Args:
        calc: Calculation string
    
    Returns:
        Formatted calculation with tags
    """
    return f"<calc>{calc}</calc>" 

