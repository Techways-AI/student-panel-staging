import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import styles from './CourseContent.module.css';

const QuizComponent = ({ questions, onSubmit }) => {
  const { isDarkMode } = useTheme();
  
  console.log('QuizComponent rendered with questions:', questions);
  console.log('Questions type:', typeof questions);
  console.log('Questions length:', Array.isArray(questions) ? questions.length : 'not an array');
  
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    console.warn('QuizComponent: No valid questions provided');
    return (
      <div className={`${styles.quizCard} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
        <h3 className={styles.quizQuestionTitle}>⚠️ MCQs Not Available</h3>
        <p className={styles.quizQuestionText}>No quiz questions could be generated for this document.</p>
        <p className={styles.quizProgress}>
          This might be due to insufficient content or processing issues.
        </p>
      </div>
    );
  }

  // Validate each question
  const validQuestions = questions.filter(q => 
    q && typeof q === 'object' && 
    q.question && typeof q.question === 'string' && q.question.trim() &&
    q.options && Array.isArray(q.options) && q.options.length === 4 &&
    q.options.every(opt => typeof opt === 'string' && opt.trim()) &&
    typeof q.answer === 'number' && q.answer >= 0 && q.answer < 4
  );
  
  console.log(`Valid questions: ${validQuestions.length}/${questions.length}`);
  
  if (validQuestions.length === 0) {
    console.warn('QuizComponent: No valid questions after validation');
    return (
      <div className={`${styles.quizCard} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
        <h3 className={styles.quizQuestionTitle}>⚠️ Invalid MCQs Data</h3>
        <p className={styles.quizQuestionText}>The quiz questions are not in the correct format.</p>
        <p className={styles.quizProgress}>
          Please try refreshing the page or contact support.
        </p>
      </div>
    );
  }

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [quizScore, setQuizScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const currentQuestion = validQuestions[currentQuestionIndex] || {};

  const handleOptionSelect = (optionIndex) => {
    if (showFeedback) return; // Prevent selecting another option after feedback is shown
    
    setSelectedOptions((prev) => {
      const updated = [...prev];
      updated[currentQuestionIndex] = optionIndex;
      return updated;
    });
    
    // Calculate score
    if (optionIndex === currentQuestion.answer) {
      setQuizScore(prev => prev + 1);
    }
    
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (currentQuestionIndex < validQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowFeedback(false);
    } else {
      // Submit quiz
      const userAnswers = selectedOptions.map(x => Number(x));
      onSubmit(userAnswers, quizScore);
      setShowResults(true);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowFeedback(false);
      // Recalculate score when going back
      const newScore = selectedOptions.slice(0, currentQuestionIndex).reduce((score, answer, index) => {
        return score + (answer === validQuestions[index].answer ? 1 : 0);
      }, 0);
      setQuizScore(newScore);
    }
  };

  if (showResults) {
    return (
      <div className={`${styles.quizCard} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
        <h3 className={styles.quizQuestionTitle}>🎉 MCQs Results</h3>
        <p className={styles.quizQuestionText}>
          You scored {quizScore} out of {validQuestions.length}
        </p>
        <p className={quizScore >= validQuestions.length * 0.7 ? styles.successText : styles.warningText}>
          {quizScore >= validQuestions.length * 0.7 ? 'Great job! 🎉' : 'Keep practicing! 💪'}
        </p>
      </div>
    );
  }

  const selectedOption = selectedOptions[currentQuestionIndex];
  const isCorrect = selectedOption === currentQuestion.answer;

  return (
    <div className={`${styles.quizCard} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
      <div className={styles.quizWrapper}>
        <h3 className={styles.quizHeader}>
          Question {currentQuestionIndex + 1} of {validQuestions.length}
        </h3>
        <p className={styles.quizQuestionText}>
          {currentQuestion.question || ''}
        </p>

        <div className={styles.quizOptions}>
          {(currentQuestion.options || []).map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrectAnswer = index === currentQuestion.answer;
            
            let optionClass = styles.quizOption;
            if (showFeedback) {
              if (isCorrectAnswer) {
                optionClass = `${styles.quizOption} ${styles.correctAnswer}`;
              } else if (isSelected && !isCorrect) {
                optionClass = `${styles.quizOption} ${styles.incorrectAnswer}`;
              }
            } else if (isSelected) {
              optionClass = `${styles.quizOption} ${styles.quizOptionSelected}`;
            }

            return (
              <div
                key={index}
                onClick={() => handleOptionSelect(index)}
                className={optionClass}
                style={{ cursor: showFeedback ? 'default' : 'pointer' }}
              >
                {String.fromCharCode(65 + index)}) {option}
              </div>
            );
          })}
        </div>

        <div className={styles.quizFooter}>
          <button
            onClick={handleBack}
            disabled={currentQuestionIndex === 0}
            className={`${styles.nextQuestionButton} ${currentQuestionIndex === 0 ? styles.disabledButton : ''}`}
          >
            Back
          </button>

          <div className={styles.quizProgress}>
            {currentQuestionIndex + 1} of {validQuestions.length}
          </div>

          <button
            onClick={handleNext}
            disabled={!showFeedback}
            className={`${styles.nextQuestionButton} ${!showFeedback ? styles.disabledButton : ''}`}
          >
            {currentQuestionIndex === validQuestions.length - 1 ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizComponent; 

