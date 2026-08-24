-- Comments now publish on arrival, so the moderation queue is gone.
--
-- Anything already sitting in PENDING was written by a reader who was told it
-- would appear after review. Leaving those rows behind would mean the queue is
-- abolished and their comments are invisible forever — the worst of both. They
-- are released, which is what the new policy would have done at the time.
--
-- SPAM is left exactly as it is: that was a judgement someone made, and it
-- still holds.
UPDATE "Comment" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
