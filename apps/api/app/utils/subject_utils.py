"""
Utility functions for handling subject names consistently across the application.
This ensures that subject codes are always removed when saving quiz data.
"""

import re
import logging

logger = logging.getLogger(__name__)

def clean_subject_name(subject_name: str) -> str:
    """
    Clean subject name by removing course codes consistently.
    
    Handles various formats:
    - "PS101: Human Anatomy and Physiology I" -> "Human Anatomy and Physiology I"
    - "PS101 Human Anatomy and Physiology I" -> "Human Anatomy and Physiology I"
    - "BS203: Biochemistry" -> "Biochemistry"
    - "Human Anatomy and Physiology I" -> "Human Anatomy and Physiology I" (no change)
    
    Args:
        subject_name (str): The subject name that may contain course codes
        
    Returns:
        str: Cleaned subject name without course codes
    """
    if not subject_name or not isinstance(subject_name, str):
        return subject_name or ""
    
    # Remove leading/trailing whitespace
    subject_name = subject_name.strip()
    
    # Pattern 1: "CODE: Subject Name" format
    if ':' in subject_name:
        parts = subject_name.split(':', 1)
        if len(parts) == 2:
            code_part = parts[0].strip()
            subject_part = parts[1].strip()
            # Check if the first part looks like a course code (contains letters and numbers)
            if re.match(r'^[A-Z]{2}\d{3}$', code_part):
                # If subject part is empty after stripping, return empty string
                if not subject_part:
                    logger.debug(f"Removed course code '{code_part}' from subject name: '{subject_name}' -> ''")
                    return ""
                logger.debug(f"Removed course code '{code_part}' from subject name: '{subject_name}' -> '{subject_part}'")
                return subject_part
    
    # Pattern 2: "CODE Subject Name" format (space instead of colon)
    words = subject_name.split()
    if len(words) >= 2:
        first_word = words[0]
        # Check if first word looks like a course code
        if re.match(r'^[A-Z]{2}\d{3}$', first_word):
            remaining_words = ' '.join(words[1:])
            logger.debug(f"Removed course code '{first_word}' from subject name: '{subject_name}' -> '{remaining_words}'")
            return remaining_words
    
    # Pattern 3: Check for other common code patterns
    # Pattern like "PS101" at the beginning
    code_pattern = r'^([A-Z]{2}\d{3})\s+(.+)$'
    match = re.match(code_pattern, subject_name)
    if match:
        code = match.group(1)
        subject = match.group(2)
        logger.debug(f"Removed course code '{code}' from subject name: '{subject_name}' -> '{subject}'")
        return subject
    
    # No code found, return as is
    logger.debug(f"No course code found in subject name: '{subject_name}'")
    return subject_name

def extract_subject_code(subject_name: str) -> str:
    """
    Extract course code from subject name if present.
    
    Args:
        subject_name (str): The subject name that may contain course codes
        
    Returns:
        str: The course code if found, empty string otherwise
    """
    if not subject_name or not isinstance(subject_name, str):
        return ""
    
    subject_name = subject_name.strip()
    
    # Pattern 1: "CODE: Subject Name" format
    if ': ' in subject_name:
        code_part = subject_name.split(': ')[0].strip()
        if re.match(r'^[A-Z]{2}\d{3}$', code_part):
            return code_part
    
    # Pattern 2: "CODE Subject Name" format
    words = subject_name.split()
    if len(words) >= 2:
        first_word = words[0]
        if re.match(r'^[A-Z]{2}\d{3}$', first_word):
            return first_word
    
    # Pattern 3: Regex pattern
    code_pattern = r'^([A-Z]{2}\d{3})'
    match = re.match(code_pattern, subject_name)
    if match:
        return match.group(1)
    
    return ""

def is_subject_name_with_code(subject_name: str) -> bool:
    """
    Check if subject name contains a course code.
    
    Args:
        subject_name (str): The subject name to check
        
    Returns:
        bool: True if subject name contains a course code, False otherwise
    """
    return bool(extract_subject_code(subject_name))

