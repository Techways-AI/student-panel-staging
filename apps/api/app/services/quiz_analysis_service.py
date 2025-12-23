import os
import json
import logging
from typing import Dict, List, Any
import google.generativeai as genai
from app.utils.header_sanitizer import sanitize_header_value

logger = logging.getLogger(__name__)

class QuizAnalysisService:
    """Service for analyzing quiz results using Gemini API"""
    
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.model = None
        
        if self.api_key:
            # Sanitize the API key to prevent gRPC metadata errors
            sanitized_api_key = sanitize_header_value(self.api_key)
            if sanitized_api_key:
                try:
                    # Configure Google AI with sanitized API key
                    genai.configure(api_key=sanitized_api_key)
                    self.model = genai.GenerativeModel('gemini-2.5-flash-lite')
                    logger.info("Google Gemini API configured successfully")
                except Exception as e:
                    logger.warning(f"Failed to configure Google Gemini API: {str(e)}")
                    self.model = None
            else:
                logger.warning("Google API key is invalid after sanitization")
        else:
            logger.warning("Google API key not found. Will use fallback analysis only.")
    
    async def analyze_quiz_performance(
        self, 
        questions: List[Dict[str, Any]], 
        user_answers: List[int], 
        score: int,
        subject: str,
        topic: str
    ) -> Dict[str, str]:
        """
        Analyze quiz performance and generate strengths, weaknesses, and areas to improve.
        
        Args:
            questions: List of quiz questions with options
            user_answers: List of user's answers (indices)
            score: User's score
            subject: Subject name
            topic: Topic name
            
        Returns:
            Dict containing strengths, weakness, and areas_to_improve
        """
        try:
            # Prepare quiz data for analysis
            quiz_data = self._prepare_quiz_data(questions, user_answers, score, subject, topic)
            
            # Try to use Gemini API if available
            if self.model:
                # Generate analysis prompt
                prompt = self._create_analysis_prompt(quiz_data)
                
                # Call Gemini API
                import asyncio
                response = await asyncio.to_thread(self.model.generate_content, prompt)
                content = response.text.strip()
                
                # Parse the response
                analysis = self._parse_analysis_response(content)
                
                logger.info(f"Successfully analyzed quiz performance for {subject} - {topic} using Gemini API")
                return analysis
            else:
                # Use fallback analysis
                logger.info(f"Using fallback analysis for {subject} - {topic} (Gemini API not available)")
                return self._get_fallback_analysis(score, subject, topic)
            
        except Exception as e:
            logger.error(f"Error analyzing quiz performance: {str(e)}")
            # Return fallback analysis
            return self._get_fallback_analysis(score, subject, topic)
    
    def _prepare_quiz_data(
        self, 
        questions: List[Dict[str, Any]], 
        user_answers: List[int], 
        score: int,
        subject: str,
        topic: str
    ) -> Dict[str, Any]:
        """Prepare quiz data for analysis"""
        quiz_analysis = []
        
        for i, (question, user_answer) in enumerate(zip(questions, user_answers)):
            correct_answer = question.get('answer', 0)
            is_correct = user_answer == correct_answer
            
            quiz_analysis.append({
                "question_number": i + 1,
                "question": question.get('question', ''),
                "options": question.get('options', []),
                "correct_answer_index": correct_answer,
                "user_answer_index": user_answer,
                "is_correct": is_correct,
                "correct_answer_text": question.get('options', [''])[correct_answer] if correct_answer < len(question.get('options', [])) else '',
                "user_answer_text": question.get('options', [''])[user_answer] if user_answer < len(question.get('options', [])) else ''
            })
        
        return {
            "subject": subject,
            "topic": topic,
            "total_questions": len(questions),
            "score": score,
            "percentage": (score / len(questions)) * 100,
            "quiz_analysis": quiz_analysis
        }
    
    def _create_analysis_prompt(self, quiz_data: Dict[str, Any]) -> str:
        """Create the analysis prompt for Gemini"""
        prompt = f"""
Quiz Performance Data:
- Subject: {quiz_data['subject']}
- Topic: {quiz_data['topic']}
- Score: {quiz_data['score']}/{quiz_data['total_questions']} ({quiz_data['percentage']:.1f}%)

Question Analysis:
"""
        
        for q in quiz_data['quiz_analysis']:
            prompt += f"""
Question {q['question_number']}: {q['question']}
Options: {', '.join(q['options'])}
Correct Answer: {q['correct_answer_text']} (Index: {q['correct_answer_index']})
Student Answer: {q['user_answer_text']} (Index: {q['user_answer_index']})
Result: {'Correct' if q['is_correct'] else 'Incorrect'}
"""
        
        prompt += f"""

Based on the quiz performance data provided, return a concise analysis in valid JSON format:

Required JSON structure:

{{
"strengths": "One sentence (≤12 words) highlighting 1-2 top-performing areas, using 'you'.",

"weaknesses": "One sentence (≤12 words) identifying 1-2 lowest-performing areas, using 'you'.",

"areas_to_improve": "One sentence (≤15 words) with 2-3 specific, actionable study recommendations."
}}

Requirements:

1. Base analysis ONLY on the provided quiz results

2. Use second-person ("you"), never third-person

3. Be topic-specific (e.g., "mitochondrial ATP synthesis", "Hardy-Weinberg equilibrium")

4. Avoid vague terms like "basics", "fundamentals", "general concepts"

5. Ensure valid JSON: proper quotes, no trailing commas, parseable syntax

6. Output ONLY the JSON object with no additional text


If insufficient data: {{"error": "Insufficient quiz data for analysis"}}
"""
        
        return prompt
    
    def _parse_analysis_response(self, content: str) -> Dict[str, str]:
        """Parse the Gemini response and extract analysis"""
        try:
            # Clean the content
            content = content.strip()
            
            # Remove any markdown code blocks if present
            if content.startswith('```json'):
                content = content[7:]
            if content.startswith('```'):
                content = content[3:]
            if content.endswith('```'):
                content = content[:-3]
            
            # Parse JSON
            analysis = json.loads(content)
            
            # Validate required fields
            required_fields = ['strengths', 'weaknesses', 'areas_to_improve']
            for field in required_fields:
                if field not in analysis:
                    raise ValueError(f"Missing required field: {field}")
            
            return {
                'strengths': str(analysis['strengths']),
                'weakness': str(analysis['weaknesses']),  # Map weaknesses to weakness for backward compatibility
                'areas_to_improve': str(analysis['areas_to_improve'])
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini analysis response: {str(e)}")
            raise Exception(f"Failed to parse analysis response: {str(e)}")
        except Exception as e:
            logger.error(f"Error parsing analysis response: {str(e)}")
            raise Exception(f"Error parsing analysis response: {str(e)}")
    
    def _get_fallback_analysis(self, score: int, subject: str, topic: str) -> Dict[str, str]:
        """Provide fallback analysis when Gemini API fails"""
        percentage = (score / 5) * 100  # Assuming 5 questions
        
        if percentage >= 80:
            strengths = f"You excel in {subject} {topic} concepts."
            weakness = f"You struggle with advanced {topic} applications."
            areas_to_improve = "Focus on complex problem-solving and advanced topic applications."
        elif percentage >= 60:
            strengths = f"You understand {subject} {topic} fundamentals well."
            weakness = f"You need work on {topic} concept details."
            areas_to_improve = f"Review core concepts and practice more {topic} problems."
        else:
            strengths = f"You have basic {subject} {topic} knowledge."
            weakness = f"You need significant {topic} concept improvement."
            areas_to_improve = f"Study fundamentals, review materials, and seek help with {topic}."
        
        return {
            'strengths': strengths,
            'weakness': weakness,
            'areas_to_improve': areas_to_improve
        }

# Global instance
quiz_analysis_service = QuizAnalysisService()

