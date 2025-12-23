-- Additional indexes for quiz completion queries optimization
-- This migration adds more specific indexes for the optimized batch loading pattern

-- Index for student_id + subject + xp_topic (with NULLS FIRST for xp_topic)
-- This optimizes the specific query pattern used in subject_content.py
CREATE INDEX IF NOT EXISTS idx_quiz_student_subject_xp_topic_nulls_first 
ON quiz (student_id, subject, xp_topic ASC NULLS FIRST);

-- Partial index for only completed quizzes (xp_topic IS NOT NULL)
-- This is extremely efficient for completion status queries
CREATE INDEX IF NOT EXISTS idx_quiz_completed_only 
ON quiz (student_id, subject) 
WHERE xp_topic IS NOT NULL;

-- Index for unit + topic combinations within a subject
-- This optimizes the lookup by unit_topic key pattern
CREATE INDEX IF NOT EXISTS idx_quiz_subject_unit_topic 
ON quiz (subject, unit, topic);

-- Composite index for all quiz filtering columns
-- This covers the complete WHERE clause in our optimized query
CREATE INDEX IF NOT EXISTS idx_quiz_complete_filter 
ON quiz (student_id, subject, xp_topic, unit, topic);

-- Analyze the tables to update statistics for query planner
ANALYZE quiz;
