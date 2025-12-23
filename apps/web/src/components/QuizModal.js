import React from 'react';
import styles from './QuizModal.module.css';

const QuizModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.quizModalOverlay} onClick={onClose}>
      <div className={styles.quizModalContent} onClick={e => e.stopPropagation()}>
        <button className={styles.quizModalClose} onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
};

export default QuizModal; 

