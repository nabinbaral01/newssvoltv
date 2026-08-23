-- Staff profiles.
--
-- `role` says what someone is allowed to do; it is a terrible byline. "ADMIN"
-- is not a job, and every writer on the masthead would otherwise read as the
-- same generic "Writer". `title` is the human-facing one — "Senior Film
-- Critic", "Games Editor" — and falls back to the role label when unset.
--
-- `staffOrder` controls masthead position: an editorial hierarchy is not
-- alphabetical, and sorting by post count would rank people by output.
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "staffOrder" INTEGER NOT NULL DEFAULT 0;

-- The masthead reads every non-READER account in one query.
CREATE INDEX "User_staffOrder_idx" ON "User" ("staffOrder");
