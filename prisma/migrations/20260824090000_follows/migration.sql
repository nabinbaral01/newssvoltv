-- Following a writer.
--
-- A join row rather than a counter column: a count alone cannot answer "am I
-- already following this person", which is the question the button has to
-- answer on every render, and it drifts the moment an account is deleted.
--
-- The unique pair is the whole safety story. Double-clicking Follow, a retried
-- request or two tabs open at once all collapse into one row instead of
-- inflating the count.
CREATE TABLE "Follow" (
  "id"         TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "authorId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Follow_followerId_authorId_key" ON "Follow" ("followerId", "authorId");
-- Reading a writer's follower count, and reading someone's following list.
CREATE INDEX "Follow_authorId_idx"   ON "Follow" ("authorId");
CREATE INDEX "Follow_followerId_idx" ON "Follow" ("followerId");

-- Cascade both ways: a deleted account should leave no dangling edges, and
-- the right-to-erasure path already deletes the User row directly.
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The reference layout carries three separate prose blocks. One `bio` column
-- cannot hold them, and cramming them in with separators would make the
-- editing form lie about what it stores.
ALTER TABLE "User" ADD COLUMN "focus"     TEXT;
ALTER TABLE "User" ADD COLUMN "favourites" TEXT;
