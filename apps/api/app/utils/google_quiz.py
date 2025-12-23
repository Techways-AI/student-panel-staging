import os
from dotenv import load_dotenv
import google.generativeai as genai
import json
from app.utils.question_bank import get_random_questions
from app.utils.header_sanitizer import sanitize_header_value

load_dotenv()

def generate_quiz_questions(year: int, semester: int):
    """
    Generate quiz questions for a specific year and semester.
    Uses question bank for prelogin assessment - NO Google API key required.
    
    Args:
        year (int): Academic year (1-4)
        semester (int): Semester (1-2)
    
    Returns:
        List[Dict]: List of 5 questions from question bank
    """
    return get_random_questions(year, semester, 5)

async def _generate_with_google(year: int, semester: int):
    """
    Generate questions using Google Gemini API for specific year and semester.
    """
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        raise Exception("Google API key not found. Please set GOOGLE_API_KEY environment variable.")
    
    # Sanitize the API key to prevent gRPC metadata errors
    sanitized_api_key = sanitize_header_value(api_key)
    if not sanitized_api_key:
        raise Exception("Google API key is invalid after sanitization. Please check your GOOGLE_API_KEY environment variable.")
    
    # Configure Google AI with sanitized API key
    genai.configure(api_key=sanitized_api_key)
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    
    prompt = (
        f"Generate 5 multiple-choice questions for B.Pharmacy, Year {year}, Semester {semester}. "
        "Each question should have 4 options. For each question, provide the index (0-3) of the correct answer. "
        "Return a list of questions in JSON format with keys: question, options, answer (where answer is the index number 0-3)."
    )
    
    try:
        # No timeout for Google API call
        import asyncio
        response = await asyncio.to_thread(model.generate_content, prompt)
        content = response.text
        
        try:
            questions = json.loads(content)
            # Validate that questions is a list
            if not isinstance(questions, list):
                raise Exception("Google API response is not a list of questions")
            
            # Ensure answer is stored as an integer
            for q in questions:
                # Validate that each question is a dictionary
                if not isinstance(q, dict):
                    raise Exception("Question is not a dictionary")
                
                if isinstance(q.get('answer'), str):
                    # If answer is a string, find its index in options
                    try:
                        q['answer'] = q['options'].index(q['answer'])
                    except ValueError:
                        # If answer text not found in options, default to 0
                        q['answer'] = 0
                else:
                    # Ensure answer is an integer between 0-3
                    q['answer'] = int(q['answer']) % 4
            return questions
        except json.JSONDecodeError:
            # If JSON parsing fails, raise an error instead of using fallback
            raise Exception(f"Failed to parse Google API response for Year {year}, Semester {semester}")
    except Exception as e:
        if "quota" in str(e).lower() or "rate" in str(e).lower():
            raise Exception("Google API quota exceeded or rate limit reached. Please try again later.")
        elif "authentication" in str(e).lower() or "api key" in str(e).lower():
            raise Exception("Google API authentication failed. Please check your API key configuration.")
        else:
            raise Exception(f"Unexpected error during Google quiz generation: {str(e)}")

async def generate_quiz_questions_from_text(text: str):
    """
    Generate quiz questions from text content using Google Gemini API.
    """
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        raise Exception("Google API key not found. Please set GOOGLE_API_KEY environment variable.")
    
    # Sanitize the API key to prevent gRPC metadata errors
    sanitized_api_key = sanitize_header_value(api_key)
    if not sanitized_api_key:
        raise Exception("Google API key is invalid after sanitization. Please check your GOOGLE_API_KEY environment variable.")
    
    # Configure Google AI with sanitized API key
    genai.configure(api_key=sanitized_api_key)
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    
    prompt = (
        f"Based on the following text, generate exactly 5 multiple-choice questions. "
        "Each question must have exactly 4 options (A, B, C, D). "
        "For each question, provide the correct answer as an index number (0, 1, 2, or 3). "
        "IMPORTANT: Return ONLY a valid JSON array containing exactly 5 question objects. "
        "Each question object must have: question (string), options (array of 4 strings), answer (integer 0-3). "
        "Do not include any explanations, markdown formatting, or additional text outside the JSON array.\n\n"
        f"Text: {text[:3000]}...\n\n"
        "Example format:\n"
        "[\n"
        "  {\n"
        "    \"question\": \"What is the molecular formula of Sodium Chloride?\",\n"
        "    \"options\": [\"NaCl\", \"Na2Cl\", \"NaCl2\", \"Na2Cl2\"],\n"
        "    \"answer\": 0\n"
        "  }\n"
        "]\n\n"
        "Generate 5 questions based on the text above:"
    )
    
    try:
        # No timeout for Google API call
        import asyncio
        response = await asyncio.to_thread(model.generate_content, prompt)
        content = response.text.strip()
        
        # Clean the content to fix common JSON issues
        content = content.strip()
        
        # Remove any markdown code blocks if present
        if content.startswith('```json'):
            content = content[7:]
        if content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        
        # Fix common escape character issues
        content = content.replace('\\n', '\\\\n')
        content = content.replace('\\"', '\\\\"')
        
        try:
            questions = json.loads(content)
            
            # Validate that questions is a list
            if not isinstance(questions, list):
                raise Exception(f"Google API response is not a list of questions. Got: {type(questions)}")
            
            # Ensure we have exactly 5 questions
            if len(questions) != 5:
                raise Exception(f"Expected 5 questions but got {len(questions)}")
            
            # Ensure answer is stored as an integer
            for i, q in enumerate(questions):
                # Validate that each question is a dictionary
                if not isinstance(q, dict):
                    raise Exception(f"Question {i} is not a dictionary")
                
                # Validate required fields
                if 'question' not in q or 'options' not in q or 'answer' not in q:
                    raise Exception(f"Question {i} missing required fields")
                
                # Validate options is a list with exactly 4 items
                if not isinstance(q['options'], list) or len(q['options']) != 4:
                    raise Exception(f"Question {i} options is not a list of 4 items")
                
                if isinstance(q.get('answer'), str):
                    # If answer is a string, find its index in options
                    try:
                        q['answer'] = q['options'].index(q['answer'])
                    except ValueError:
                        # If answer text not found in options, default to 0
                        q['answer'] = 0
                else:
                    # Ensure answer is an integer between 0-3
                    q['answer'] = int(q['answer']) % 4
                    
            return questions
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse Google API response for document-based quiz generation: {str(e)}")
    except Exception as e:
        error_message = str(e)
        if "quota" in error_message.lower() or "rate" in error_message.lower():
            raise Exception("Google API quota exceeded or rate limit reached. Please try again later.")
        elif "authentication" in error_message.lower() or "api key" in error_message.lower():
            raise Exception("Google API authentication failed. Please check your API key configuration.")
        else:
            raise Exception(f"Unexpected error during Google quiz generation: {str(e)}")


