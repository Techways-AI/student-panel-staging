"use client";
import React, { useState } from 'react';
import styles from './ModelPaper.module.css';

const ModelPaper = ({ modelPaper, onClose }) => {
  const [showAnswers, setShowAnswers] = useState(false);
  const [currentSection, setCurrentSection] = useState('questions'); // 'questions' or 'answers'



  if (!modelPaper) {

    return null;
  }

  // Add more robust error handling for destructuring
  const subject = modelPaper?.subject || 'Unknown Subject';
  const topic = modelPaper?.topic || 'General';
  const questions = modelPaper?.questions || [];
  const answers = modelPaper?.answers || [];
  const total_questions = modelPaper?.total_questions || 0;
  const time_limit = modelPaper?.time_limit || 60;
  const difficulty = modelPaper?.difficulty || 'Intermediate';
  


  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} minutes`;
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>Model Paper: {subject}</h2>
            <p className={styles.subtitle}>Topic: {topic}</p>
            <div className={styles.metaInfo}>
              <span className={styles.metaItem}>
                <span className={styles.icon}>📝</span>
                {total_questions} Questions
              </span>
              <span className={styles.metaItem}>
                <span className={styles.icon}>⏱️</span>
                {formatTime(time_limit)}
              </span>
              <span className={styles.metaItem}>
                <span className={styles.icon}>📊</span>
                {difficulty}
              </span>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${currentSection === 'questions' ? styles.active : ''}`}
            onClick={() => setCurrentSection('questions')}
          >
            📋 Questions ({Array.isArray(questions) ? questions.length : 0})
          </button>
          <button
            className={`${styles.tab} ${currentSection === 'answers' ? styles.active : ''}`}
            onClick={() => setCurrentSection('answers')}
          >
            ✅ Answers ({Array.isArray(answers) ? answers.length : 0})
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {currentSection === 'questions' ? (
            <div className={styles.questionsSection}>
              <div className={styles.instructions}>
                <h3>Instructions:</h3>
                <ul>
                  <li>Read each question carefully</li>
                  <li>Select the best answer from the given options</li>
                  <li>You have {formatTime(time_limit)} to complete this paper</li>
                  <li>Click on "Answers" tab to view solutions</li>
                </ul>
              </div>
              
              <div className={styles.questionsList}>
                {Array.isArray(questions) && questions.length > 0 ? questions.map((question, index) => (
                  <div key={index} className={styles.questionCard}>
                    <div className={styles.questionHeader}>
                      <span className={styles.questionNumber}>Q{index + 1}</span>
                      <span className={styles.questionType}>
                        {(question?.question_type || 'short_answer') === 'short_answer' ? 'Short Answer' : 'Long Answer'} ({question?.marks || 5} marks)
                      </span>
                    </div>
                    
                    <div className={styles.questionText}>
                      {question?.question || 'Question text not available'}
                    </div>
                    
                    <div className={styles.answerSpace}>
                      <div className={styles.answerLines}>
                        {(question?.question_type || 'short_answer') === 'short_answer' ? (
                          // Short answer - fewer lines
                          Array.from({ length: 8 }, (_, i) => (
                            <div key={i} className={styles.answerLine}></div>
                          ))
                        ) : (
                          // Long answer - more lines
                          Array.from({ length: 15 }, (_, i) => (
                            <div key={i} className={styles.answerLine}></div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className={styles.noQuestions}>
                    <p>No questions available for this model paper.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.answersSection}>
              <div className={styles.instructions}>
                <h3>Answer Key:</h3>
                <p>Review the correct answers and explanations below.</p>
              </div>
              
              <div className={styles.answersList}>
                {Array.isArray(answers) && answers.length > 0 ? answers.map((answer, index) => (
                  <div key={index} className={styles.answerCard}>
                    <div className={styles.answerHeader}>
                      <span className={styles.answerNumber}>Q{index + 1}</span>
                      <span className={styles.correctLabel}>
                        {(answer?.question_type || 'short_answer') === 'short_answer' ? 'Short Answer' : 'Long Answer'} ({answer?.marks || 5} marks)
                      </span>
                    </div>
                    
                    <div className={styles.questionText}>
                      {answer?.question || 'Question text not available'}
                    </div>
                    
                    <div className={styles.correctAnswer}>
                      <span className={styles.answerLabel}>Answer:</span>
                      <div className={styles.answerText}>
                        {answer?.answer || 'Answer not available'}
                      </div>
                    </div>
                    
                    {Array.isArray(answer?.key_points) && answer.key_points.length > 0 && (
                      <div className={styles.keyPoints}>
                        <span className={styles.keyPointsLabel}>Key Points:</span>
                        <ul className={styles.keyPointsList}>
                          {answer.key_points.map((point, pointIndex) => (
                            <li key={pointIndex} className={styles.keyPoint}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className={styles.noAnswers}>
                    <p>No answers available for this model paper.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerInfo}>
            <span>Model Paper generated from course materials</span>
          </div>
          <div className={styles.footerActions}>
            <button 
              className={styles.printButton}
              onClick={() => window.print()}
            >
              🖨️ Print
            </button>
            <button 
              className={styles.downloadButton}
              onClick={() => {
                const content = JSON.stringify(modelPaper, null, 2);
                const blob = new Blob([content], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${subject}_Model_Paper.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              📥 Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelPaper; 

