import os
from dotenv import load_dotenv
import openai
import json
from .question_bank import get_random_questions

load_dotenv()

def generate_quiz_questions(year: int, semester: int):
    """
    Generate quiz questions for a specific year and semester.
    Uses question bank for prelogin assessment - NO OpenAI API key required.
    
    Args:
        year (int): Academic year (1-4)
        semester (int): Semester (1-2)
    
    Returns:
        List[Dict]: List of 5 questions from question bank
    """
    return get_random_questions(year, semester, 5)

def _generate_with_openai(year: int, semester: int):
    """
    Generate questions using OpenAI for specific year and semester.
    """
    client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    prompt = (
        f"Generate 5 multiple-choice questions for B.Pharmacy, Year {year}, Semester {semester}. "
        "Each question should have 4 options. For each question, provide the index (0-3) of the correct answer. "
        "Return a list of questions in JSON format with keys: question, options, answer (where answer is the index number 0-3)."
    )
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
        )
        content = response.choices[0].message.content
        try:
            questions = json.loads(content)
            # Validate that questions is a list
            if not isinstance(questions, list):
                raise Exception("OpenAI response is not a list of questions")
            
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
            raise Exception(f"Failed to parse OpenAI response for Year {year}, Semester {semester}")
    except openai.RateLimitError as e:
        # Handle rate limit and quota exceeded errors
        error_message = str(e)
        if "insufficient_quota" in error_message or "quota" in error_message.lower():
            raise Exception("OpenAI quota exceeded. Please check your OpenAI account billing and usage limits.")
        elif "rate limit" in error_message.lower():
            raise Exception("OpenAI rate limit exceeded. Please try again in a few minutes.")
        else:
            raise Exception(f"OpenAI rate limit error: {error_message}")
    except openai.AuthenticationError as e:
        raise Exception("OpenAI authentication failed. Please check your API key configuration.")
    except openai.APIError as e:
        raise Exception(f"OpenAI API error: {str(e)}")
    except Exception as e:
        raise Exception(f"Unexpected error during OpenAI quiz generation: {str(e)}")

async def generate_quiz_questions_from_text(text: str):
    client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
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
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a quiz generator. Always return valid JSON arrays with exactly 5 multiple-choice questions. Each question must have 4 options and a correct answer index (0-3)."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.7
        )
        content = response.choices[0].message.content.strip()
        
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
                raise Exception(f"OpenAI response is not a list of questions. Got: {type(questions)}")
            
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
            raise Exception(f"Failed to parse OpenAI response for document-based quiz generation: {str(e)}")
    except openai.RateLimitError as e:
        # Handle rate limit and quota exceeded errors
        error_message = str(e)
        if "insufficient_quota" in error_message or "quota" in error_message.lower():
            raise Exception("OpenAI quota exceeded. Please check your OpenAI account billing and usage limits.")
        elif "rate limit" in error_message.lower():
            raise Exception("OpenAI rate limit exceeded. Please try again in a few minutes.")
        else:
            raise Exception(f"OpenAI rate limit error: {error_message}")
    except openai.AuthenticationError as e:
        raise Exception("OpenAI authentication failed. Please check your API key configuration.")
    except openai.APIError as e:
        raise Exception(f"OpenAI API error: {str(e)}")
    except Exception as e:
        raise Exception(f"Unexpected error during OpenAI quiz generation: {str(e)}") 

async def generate_model_paper_questions_from_text(text: str, num_questions: int = 15):
    """
    Generate model paper questions from text content using OpenAI.
    Designed specifically for model papers with short answer and long answer questions.
    """
    client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    # Truncate text to avoid token limits while keeping important content
    max_text_length = 4000  # Increased for model papers
    truncated_text = text[:max_text_length] + "..." if len(text) > max_text_length else text
    
    prompt = (
        f"Based on the following academic text, generate exactly {num_questions} MODEL PAPER questions for B.Pharmacy students. "
        "These should be a mix of SHORT ANSWER and LONG ANSWER questions (NOT multiple choice). "
        "IMPORTANT: Return ONLY a valid JSON array containing exactly {num_questions} question objects. "
        "Each question object must have: question (string), question_type (string: 'short_answer' or 'long_answer'), marks (integer: 2-10). "
        "Make questions challenging, comprehensive, and suitable for a final model paper/exam. "
        "Focus on key concepts, definitions, relationships, and practical applications. "
        "Do not include any explanations, markdown formatting, or additional text outside the JSON array.\n\n"
        f"Academic Text: {truncated_text}\n\n"
        "Example format:\n"
        "[\n"
        "  {\n"
        "    \"question\": \"Explain the anatomical position and its significance in human anatomy.\",\n"
        "    \"question_type\": \"short_answer\",\n"
        "    \"marks\": 5\n"
        "  },\n"
        "  {\n"
        "    \"question\": \"Describe in detail the structure and function of the cardiovascular system. Include the role of the heart, blood vessels, and blood in maintaining homeostasis.\",\n"
        "    \"question_type\": \"long_answer\",\n"
        "    \"marks\": 10\n"
        "  }\n"
        "]\n\n"
        f"Generate {num_questions} comprehensive MODEL PAPER questions based on the academic text above:"
    )
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": f"You are an academic MODEL PAPER generator for B.Pharmacy students. Generate exactly {num_questions} comprehensive questions based on the provided text. These should be a mix of short answer (2-5 marks) and long answer (6-10 marks) questions that test deep understanding. Focus on complex concepts, relationships, applications, and critical thinking."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2500,  # Increased for comprehensive questions
            temperature=0.8  # Slightly higher for more creative questions
        )
        content = response.choices[0].message.content.strip()
        
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
                raise Exception(f"OpenAI response is not a list of questions. Got: {type(questions)}")
            
            # Ensure we have the expected number of questions
            if len(questions) != num_questions:
                # Don't fail if we get fewer questions, just log it
                pass
            
            # Validate and process each question
            for i, q in enumerate(questions):
                # Validate that each question is a dictionary
                if not isinstance(q, dict):
                    raise Exception(f"Question {i} is not a dictionary")
                
                # Validate required fields
                if 'question' not in q or 'question_type' not in q or 'marks' not in q:
                    raise Exception(f"Question {i} missing required fields")
                
                # Validate question_type
                if q['question_type'] not in ['short_answer', 'long_answer']:
                    raise Exception(f"Question {i} has invalid question_type")
                
                # Validate marks
                if not isinstance(q['marks'], int) or q['marks'] < 2 or q['marks'] > 10:
                    raise Exception(f"Question {i} has invalid marks")
                    
            return questions
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse OpenAI response for model paper generation: {str(e)}")
    except openai.RateLimitError as e:
        # Handle rate limit and quota exceeded errors
        error_message = str(e)
        if "insufficient_quota" in error_message or "quota" in error_message.lower():
            raise Exception("OpenAI quota exceeded. Please check your OpenAI account billing and usage limits.")
        elif "rate limit" in error_message.lower():
            raise Exception("OpenAI rate limit exceeded. Please try again in a few minutes.")
        else:
            raise Exception(f"OpenAI rate limit error: {error_message}")
    except openai.AuthenticationError as e:
        raise Exception("OpenAI authentication failed. Please check your API key configuration.")
    except openai.APIError as e:
        raise Exception(f"OpenAI API error: {str(e)}")
    except Exception as e:
        raise Exception(f"Unexpected error during OpenAI model paper generation: {str(e)}")

async def generate_model_paper_answers(questions: list, text: str):
    """
    Generate comprehensive answers for model paper questions using OpenAI.
    """
    client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    # Truncate text to avoid token limits
    max_text_length = 3000
    truncated_text = text[:max_text_length] + "..." if len(text) > max_text_length else text
    
    # Create a prompt for generating answers
    questions_text = "\n".join([f"{i+1}. {q['question']} ({q['marks']} marks - {q['question_type']})" for i, q in enumerate(questions)])
    
    prompt = (
        f"Based on the following academic text, provide comprehensive answers for the model paper questions below. "
        "For each question, provide a detailed, well-structured answer that would earn full marks. "
        "IMPORTANT: Return ONLY a valid JSON array containing exactly {len(questions)} answer objects. "
        "Each answer object must have: question_number (integer), answer (string), key_points (array of strings). "
        "Make answers comprehensive, accurate, and suitable for B.Pharmacy students. "
        "Do not include any explanations, markdown formatting, or additional text outside the JSON array.\n\n"
        f"Academic Text: {truncated_text}\n\n"
        f"Questions:\n{questions_text}\n\n"
        "Example format:\n"
        "[\n"
        "  {\n"
        "    \"question_number\": 1,\n"
        "    \"answer\": \"The anatomical position is a standardized reference point for describing body structures...\",\n"
        "    \"key_points\": [\"Standardized reference point\", \"Upright position\", \"Arms at sides\", \"Palms forward\"]\n"
        "  }\n"
        "]\n\n"
        f"Generate comprehensive answers for all {len(questions)} questions:"
    )
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an academic model paper answer generator for B.Pharmacy students. Provide comprehensive, detailed answers that would earn full marks. Focus on accuracy, completeness, and clarity."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=3000,  # Increased for detailed answers
            temperature=0.7
        )
        content = response.choices[0].message.content.strip()
        
        # Clean the content
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:]
        if content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        
        content = content.replace('\\n', '\\\\n')
        content = content.replace('\\"', '\\\\"')
        
        try:
            answers = json.loads(content)
            
            # Validate that answers is a list
            if not isinstance(answers, list):
                raise Exception(f"OpenAI response is not a list of answers. Got: {type(answers)}")
            
            # Ensure we have the expected number of answers
            if len(answers) != len(questions):
                raise Exception(f"Expected {len(questions)} answers but got {len(answers)}")
            
            # Validate and process each answer
            for i, a in enumerate(answers):
                # Validate that each answer is a dictionary
                if not isinstance(a, dict):
                    raise Exception(f"Answer {i} is not a dictionary")
                
                # Validate required fields
                if 'question_number' not in a or 'answer' not in a or 'key_points' not in a:
                    raise Exception(f"Answer {i} missing required fields")
                
                # Validate key_points is a list
                if not isinstance(a['key_points'], list):
                    raise Exception(f"Answer {i} key_points is not a list")
                    
            return answers
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse OpenAI response for model paper answers: {str(e)}")
    except openai.RateLimitError as e:
        error_message = str(e)
        if "insufficient_quota" in error_message or "quota" in error_message.lower():
            raise Exception("OpenAI quota exceeded. Please check your OpenAI account billing and usage limits.")
        elif "rate limit" in error_message.lower():
            raise Exception("OpenAI rate limit exceeded. Please try again in a few minutes.")
        else:
            raise Exception(f"OpenAI rate limit error: {error_message}")
    except openai.AuthenticationError as e:
        raise Exception("OpenAI authentication failed. Please check your API key configuration.")
    except openai.APIError as e:
        raise Exception(f"OpenAI API error: {str(e)}")
    except Exception as e:
        raise Exception(f"Unexpected error during OpenAI model paper answer generation: {str(e)}") 

