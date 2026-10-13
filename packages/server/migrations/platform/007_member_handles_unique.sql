CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_handle
  ON workspace_members(workspace_id, handle);
