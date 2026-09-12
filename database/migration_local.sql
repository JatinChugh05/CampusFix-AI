-- =============================================================
-- migration_local.sql
-- Safe, additive-only migration for the railway database.
-- Run this once against your local MySQL instance.
-- Nothing is dropped or renamed.
-- Compatible with MySQL 8.0.
-- =============================================================

USE railway;

-- -------------------------------------------------------------
-- 1. complaints — add missing columns
-- ADD COLUMN IF NOT EXISTS is not supported in MySQL 8.0.
-- Each column is guarded by an information_schema check
-- executed as a prepared statement so re-runs are safe.
-- -------------------------------------------------------------

-- reference_number
SET @colExists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'railway'
    AND TABLE_NAME   = 'complaints'
    AND COLUMN_NAME  = 'reference_number'
);
SET @sql = IF(
  @colExists = 0,
  'ALTER TABLE complaints ADD COLUMN reference_number VARCHAR(30) NULL AFTER id',
  'SELECT ''reference_number already exists, skipping'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- unique constraint on reference_number (allows multiple NULLs in MySQL)
SET @rnIdx = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'railway'
    AND TABLE_NAME   = 'complaints'
    AND INDEX_NAME   = 'uq_complaints_reference_number'
);
SET @sql = IF(
  @rnIdx = 0,
  'ALTER TABLE complaints ADD UNIQUE KEY uq_complaints_reference_number (reference_number)',
  'SELECT ''uq_complaints_reference_number already exists, skipping'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- due_at (may already have been added manually)
SET @colExists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'railway'
    AND TABLE_NAME   = 'complaints'
    AND COLUMN_NAME  = 'due_at'
);
SET @sql = IF(
  @colExists = 0,
  'ALTER TABLE complaints ADD COLUMN due_at TIMESTAMP NULL AFTER resolved_at',
  'SELECT ''due_at already exists, skipping'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_escalated
SET @colExists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'railway'
    AND TABLE_NAME   = 'complaints'
    AND COLUMN_NAME  = 'is_escalated'
);
SET @sql = IF(
  @colExists = 0,
  'ALTER TABLE complaints ADD COLUMN is_escalated TINYINT(1) NOT NULL DEFAULT 0 AFTER due_at',
  'SELECT ''is_escalated already exists, skipping'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- escalation_level
SET @colExists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'railway'
    AND TABLE_NAME   = 'complaints'
    AND COLUMN_NAME  = 'escalation_level'
);
SET @sql = IF(
  @colExists = 0,
  'ALTER TABLE complaints ADD COLUMN escalation_level TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER is_escalated',
  'SELECT ''escalation_level already exists, skipping'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- escalated_at
SET @colExists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'railway'
    AND TABLE_NAME   = 'complaints'
    AND COLUMN_NAME  = 'escalated_at'
);
SET @sql = IF(
  @colExists = 0,
  'ALTER TABLE complaints ADD COLUMN escalated_at TIMESTAMP NULL AFTER escalation_level',
  'SELECT ''escalated_at already exists, skipping'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index on is_escalated (used in WHERE c.is_escalated = ?)
SET @escIdx = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'railway'
    AND TABLE_NAME   = 'complaints'
    AND INDEX_NAME   = 'idx_complaints_escalated'
);
SET @sql = IF(
  @escIdx = 0,
  'CREATE INDEX idx_complaints_escalated ON complaints (is_escalated)',
  'SELECT ''idx_complaints_escalated already exists, skipping'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index on due_at (used in analytics SUM with due_at < NOW())
SET @dueIdx = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'railway'
    AND TABLE_NAME   = 'complaints'
    AND INDEX_NAME   = 'idx_complaints_due_at'
);
SET @sql = IF(
  @dueIdx = 0,
  'CREATE INDEX idx_complaints_due_at ON complaints (due_at)',
  'SELECT ''idx_complaints_due_at already exists, skipping'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -------------------------------------------------------------
-- 2. notifications — create if not exists
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id           INT            NOT NULL AUTO_INCREMENT,
  user_id      INT            NOT NULL,
  complaint_id INT            NULL,
  message      VARCHAR(500)   NOT NULL,
  type         VARCHAR(50)    NOT NULL,
  is_read      TINYINT(1)     NOT NULL DEFAULT 0,
  created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT fk_notification_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_notification_complaint
    FOREIGN KEY (complaint_id)
    REFERENCES complaints (id)
    ON DELETE SET NULL,

  INDEX idx_notifications_user_created (user_id, created_at),
  INDEX idx_notifications_user_read    (user_id, is_read)
);

-- -------------------------------------------------------------
-- 3. complaint_feedback — create if not exists
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS complaint_feedback (
  id           INT        NOT NULL AUTO_INCREMENT,
  complaint_id INT        NOT NULL,
  student_id   INT        NOT NULL,
  rating       TINYINT    NOT NULL,
  feedback     TEXT       NULL,
  created_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- one feedback entry per complaint (enforced in app code and here)
  UNIQUE KEY uq_feedback_complaint (complaint_id),

  CONSTRAINT fk_feedback_complaint
    FOREIGN KEY (complaint_id)
    REFERENCES complaints (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_feedback_student
    FOREIGN KEY (student_id)
    REFERENCES users (id)
    ON DELETE CASCADE,

  INDEX idx_feedback_student (student_id)
);

-- -------------------------------------------------------------
-- 4. password_reset_otps — create if not exists
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id         INT           NOT NULL AUTO_INCREMENT,
  user_id    INT           NOT NULL,
  otp_hash   VARCHAR(255)  NOT NULL,
  expires_at TIMESTAMP     NOT NULL,
  attempts   TINYINT       NOT NULL DEFAULT 0,
  verified   TINYINT(1)    NOT NULL DEFAULT 0,
  used       TINYINT(1)    NOT NULL DEFAULT 0,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT fk_otp_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE,

  -- main lookup: WHERE user_id = ? AND used = FALSE ORDER BY created_at DESC
  INDEX idx_otp_user_used (user_id, used)
);
