import React from 'react';

const QuizCompleted = ({ score, totalQuestions, completedAt, onBack, onNextTopic, hasNextTopic }) => {
  const percentage = Math.round((score / totalQuestions) * 100);
  
  const getScoreColor = (percentage) => {
    if (percentage >= 80) return '#10b981'; // Green
    if (percentage >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const getScoreMessage = (percentage) => {
    if (percentage >= 80) return 'Excellent!';
    if (percentage >= 60) return 'Good job!';
    return 'Keep practicing!';
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '32px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      textAlign: 'center',
      maxWidth: '500px',
      margin: '0 auto',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <div style={{
        fontSize: '4rem',
        marginBottom: '16px'
      }}>
        🎉
      </div>
      
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: '8px'
      }}>
        MCQs Already Completed!
      </h2>
      
      <p style={{
        color: '#6b7280',
        marginBottom: '24px',
        fontSize: '1rem'
      }}>
        You have already taken these MCQs for this topic.
      </p>
      
      <div style={{
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '2px solid #e2e8f0'
      }}>
        <div style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: getScoreColor(percentage),
          marginBottom: '8px'
        }}>
          {score}/{totalQuestions}
        </div>
        <div style={{
          fontSize: '1rem',
          color: '#6b7280',
          marginBottom: '16px'
        }}>
          {getScoreMessage(percentage)}
        </div>
        
        {completedAt && (
          <div style={{
            fontSize: '0.9rem',
            color: '#9ca3af',
            fontStyle: 'italic'
          }}>
            Completed on {new Date(completedAt).toLocaleDateString()}
          </div>
        )}
      </div>
      
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            fontSize: '1rem',
            borderRadius: '8px',
            background: '#6b7280',
            color: '#fff',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#4b5563'}
          onMouseOut={(e) => e.target.style.background = '#6b7280'}
        >
          Back to Notes
        </button>
        
        {hasNextTopic && (
          <button
            onClick={onNextTopic}
            style={{
              padding: '12px 24px',
              fontSize: '1rem',
              borderRadius: '8px',
              background: '#00A8E8',
              color: '#fff',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 2px 8px rgba(0, 168, 232, 0.3)'
            }}
            onMouseOver={(e) => e.target.style.background = '#0096d1'}
            onMouseOut={(e) => e.target.style.background = '#00A8E8'}
          >
            Next Topic →
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizCompleted; 

