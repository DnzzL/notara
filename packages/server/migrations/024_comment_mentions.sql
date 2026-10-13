-- Who a comment mentions (NOT-151): the members whose @handle it contains,
-- resolved when it is written or edited. The inbox (NOT-152) reads this.
-- The FK pragma is off: deleting a comment, or purging its page, deletes these.
CREATE TABLE IF NOT EXISTS comment_mentions (
  comment_id TEXT NOT NULL REFERENCES comments(id),
  user_id TEXT NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user ON comment_mentions(user_id);
