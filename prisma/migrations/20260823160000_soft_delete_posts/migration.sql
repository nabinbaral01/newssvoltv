-- Soft delete for posts. A deleted post keeps its row, comments and analytics
-- until the retention job purges it, so a mis-click is recoverable.
ALTER TABLE "Post" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Post_deletedAt_status_publishedAt_idx"
  ON "Post"("deletedAt", "status", "publishedAt");

ALTER TABLE "Post" ADD CONSTRAINT "Post_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
