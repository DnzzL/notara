-- API keys carry a scope.
--
-- Until now a key authenticated as its owner and carried every right that user
-- had, so a key handed to a CI job could delete a workspace as readily as it
-- could list pages. "Give my CI a read-only key" is the first thing an
-- integrator asks for, and answering it after keys exist in the wild means
-- either breaking them or carrying an unscoped state forever.
--
-- Neither is necessary. Existing keys become 'write' keys: the default names
-- what they already are rather than inventing a grandfathered state. There is
-- no "unscoped key" in the model — only read keys and write keys.
--
-- Two values, deliberately. ADR-008 records that a permission vocabulary earns
-- its place only where an axis escapes relations; a credential's reach is such
-- an axis, but one with two useful positions. Per-resource scopes for a
-- three-noun API would be a selection screen nobody reads before ticking every
-- box.
ALTER TABLE api_keys
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'write'
  CHECK (scope IN ('read', 'write'));
