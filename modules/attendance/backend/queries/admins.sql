-- admins: everyone who changes attendance. People sign in to NxtOne only; its identity token says
-- who they are and what they may do, so a row here only records who made a change (updated_by,
-- created_by, uploaded_by, ...). role, active and the password columns are no longer read.

-- name: EnsureAdmin :one
-- NxtOne sign-in: the row that records what this person changes (updated_by, created_by, ...),
-- found by email or created. Access comes from NxtOne's identity token, never from role or active here.
INSERT INTO admins (email, name)
VALUES (lower(sqlc.arg(email)::text), sqlc.arg(name)::text)
ON CONFLICT (email) DO UPDATE SET name = CASE WHEN admins.name = '' THEN EXCLUDED.name ELSE admins.name END
RETURNING id;
