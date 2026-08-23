-- Brand recolour: the default accent for a newly created category moves off
-- amber. Existing rows were migrated separately; this only affects new ones.
ALTER TABLE "Category" ALTER COLUMN "colour" SET DEFAULT '#00E88F';
