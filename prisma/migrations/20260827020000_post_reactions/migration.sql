-- Likes and saves.
--
-- One table with a kind rather than two near-identical ones. They have the
-- same shape, the same uniqueness rule and the same lifecycle; splitting them
-- would mean writing every query, index and cascade twice for no gain, and a
-- third reaction later would mean a third table.
--
-- As with follows, the row is the record: a counter alone cannot answer "have
-- I already liked this", which is what the button has to know on every render.
CREATE TYPE "ReactionKind" AS ENUM ('LIKE', 'SAVE');

CREATE TABLE "PostReaction" (
  "id"        TEXT NOT NULL,
  "postId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "kind"      "ReactionKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("id")
);

-- The whole safety story: a double-tap, a retry, or two tabs open all collapse
-- into one row instead of inflating the count.
CREATE UNIQUE INDEX "PostReaction_postId_userId_kind_key"
  ON "PostReaction" ("postId", "userId", "kind");

-- Counting an article's likes.
CREATE INDEX "PostReaction_postId_kind_idx" ON "PostReaction" ("postId", "kind");
-- Listing what one reader has saved.
CREATE INDEX "PostReaction_userId_kind_idx" ON "PostReaction" ("userId", "kind");

ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
