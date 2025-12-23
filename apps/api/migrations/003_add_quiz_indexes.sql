-- Migration: Add indexes for quiz completion queries optimization
-- This will significantly speed up topic completion checks and batch queries

-- Index for student_id + subject + unit + topic queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_quiz_student_subject_unit_topic ON quiz (student_id, subject, unit, topic);

-- Index for student_id + subject queries (batch loading)
CREATE INDEX IF NOT EXISTS idx_quiz_student_subject ON quiz (student_id, subject);

-- Index for xp_topic filtering (completion status)
CREATE INDEX IF NOT EXISTS idx_quiz_xp_topic ON quiz (xp_topic) WHERE xp_topic IS NOT NULL;

-- Composite index for student + subject + xp_topic (optimized completion queries)
CREATE INDEX IF NOT EXISTS idx_quiz_student_subject_completion ON quiz (student_id, subject, xp_topic);

-- Index for created_at ordering (recent quiz queries)
CREATE INDEX IF NOT EXISTS idx_quiz_created_at ON quiz (created_at DESC);

-- Index for year and semester filtering
CREATE INDEX IF NOT EXISTS idx_quiz_year_semester ON quiz (year, semester);

-- Index for QuizAttemptedQuestion table
CREATE INDEX IF NOT EXISTS idx_quiz_attempted_questions_quiz_id ON quiz_attempted_question (quiz_id);

-- Add indexes to TopicCompletion table for faster completion checks
CREATE INDEX IF NOT EXISTS idx_topic_completion_user_subject_unit_topic ON topic_completions (user_id, subject, unit, topic);
CREATE INDEX IF NOT EXISTS idx_topic_completion_user_date ON topic_completions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_topic_completion_completed ON topic_completions (topic_completed) WHERE topic_completed = TRUE;

-- Add indexes to CourseStructure table for faster structure queries
CREATE INDEX IF NOT EXISTS idx_course_structure_course_year_semester ON course_structure (course_name, year, semester);
CREATE INDEX IF NOT EXISTS idx_course_structure_subject ON course_structure (subject_name);
CREATE INDEX IF NOT EXISTS idx_course_structure_unit_order ON course_structure (unit_order);
CREATE INDEX IF NOT EXISTS idx_course_structure_topic_order ON course_structure (topic_order);

-- Analyze tables to update statistics for query planner
ANALYZE quiz;
ANALYZE quiz_attempted_question;
ANALYZE topic_completions;
ANALYZE course_structure;
