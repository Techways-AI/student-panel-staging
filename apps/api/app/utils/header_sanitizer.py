"""
Utility functions for sanitizing HTTP headers and metadata to prevent gRPC errors.
"""
import re
import logging

logger = logging.getLogger(__name__)

def sanitize_header_value(value: str) -> str:
    """
    Sanitize header values to prevent gRPC "Illegal header value" errors.
    
    Args:
        value: The header value to sanitize
        
    Returns:
        Sanitized header value that's safe for HTTP/2 and gRPC
    """
    if not value:
        return ""
    
    # Convert to string if not already
    value = str(value)
    
    # Strip whitespace and newlines
    value = value.strip()
    
    # Remove any carriage returns or line feeds
    value = value.replace('\r', '').replace('\n', '')
    
    # Remove any non-printable ASCII characters (except space)
    value = ''.join(char for char in value if char.isprintable() or char == ' ')
    
    # Replace multiple spaces with single space
    value = ' '.join(value.split())
    
    # Ensure the value doesn't start or end with spaces
    value = value.strip()
    
    # Check for common problematic patterns
    if value.startswith('Bearer '):
        # Ensure Bearer token doesn't have extra whitespace
        parts = value.split(' ', 1)
        if len(parts) == 2:
            token = parts[1].strip()
            value = f"Bearer {token}"
    
    return value

def sanitize_header_key(key: str) -> str:
    """
    Sanitize header keys to ensure they're valid for HTTP/2 and gRPC.
    
    Args:
        key: The header key to sanitize
        
    Returns:
        Sanitized header key
    """
    if not key:
        return ""
    
    # Convert to string and strip whitespace
    key = str(key).strip()
    
    # Convert to lowercase (HTTP/2 requirement)
    key = key.lower()
    
    # Remove any non-ASCII characters
    key = ''.join(char for char in key if char.isascii())
    
    # Remove any characters that aren't valid in header names
    key = re.sub(r'[^a-z0-9\-_]', '', key)
    
    return key

def sanitize_headers(headers: dict) -> dict:
    """
    Sanitize all headers in a dictionary to prevent gRPC errors.
    
    Args:
        headers: Dictionary of headers to sanitize
        
    Returns:
        Dictionary with sanitized headers
    """
    if not headers:
        return {}
    
    sanitized = {}
    
    for key, value in headers.items():
        try:
            # Sanitize both key and value
            clean_key = sanitize_header_key(key)
            clean_value = sanitize_header_value(value)
            
            # Only add if both key and value are valid
            if clean_key and clean_value:
                sanitized[clean_key] = clean_value
            else:
                logger.warning(f"Skipping invalid header: {key}={value}")
                
        except Exception as e:
            logger.error(f"Error sanitizing header {key}={value}: {str(e)}")
            continue
    
    return sanitized

def create_safe_auth_header(token: str) -> dict:
    """
    Create a safe Authorization header with Bearer token.
    
    Args:
        token: The JWT token to use
        
    Returns:
        Dictionary with sanitized Authorization header
    """
    if not token:
        return {}
    
    # Sanitize the token
    clean_token = sanitize_header_value(token)
    
    if not clean_token:
        logger.warning("Token is empty after sanitization")
        return {}
    
    # Create the Bearer header
    auth_value = f"Bearer {clean_token}"
    
    # Sanitize the complete header value
    safe_auth_value = sanitize_header_value(auth_value)
    
    return {
        "authorization": safe_auth_value
    }

def validate_headers_for_grpc(headers: dict) -> bool:
    """
    Validate that headers are safe for gRPC usage.
    
    Args:
        headers: Dictionary of headers to validate
        
    Returns:
        True if headers are safe, False otherwise
    """
    if not headers:
        return True
    
    for key, value in headers.items():
        # Check key
        if not isinstance(key, str) or not key.isascii() or not key.islower():
            logger.error(f"Invalid header key: {key}")
            return False
        
        # Check value
        if not isinstance(value, str):
            logger.error(f"Header value must be string: {key}={value}")
            return False
        
        # Check for problematic characters
        if '\r' in value or '\n' in value:
            logger.error(f"Header value contains newlines: {key}={value}")
            return False
        
        # Check for non-printable characters
        if not all(char.isprintable() or char == ' ' for char in value):
            logger.error(f"Header value contains non-printable characters: {key}={value}")
            return False
    
    return True

