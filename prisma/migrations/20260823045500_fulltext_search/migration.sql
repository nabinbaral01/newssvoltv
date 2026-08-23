-- Full-text search across headline, standfirst and flattened body text.
-- Expression index: to_tsvector with a constant regconfig is IMMUTABLE, so
-- Postgres can index it directly without a stored generated column.
CREATE INDEX "Post_search_idx" ON "Post" USING GIN (
  to_tsvector(
    'english',
    coalesce("title", '') || ' ' || coalesce("excerpt", '') || ' ' || coalesce("bodyText", '')
  )
);

-- Trigram matching gives us fuzzy tag/author lookups in the admin pickers.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Tag_name_trgm_idx" ON "Tag" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Post_title_trgm_idx" ON "Post" USING GIN ("title" gin_trgm_ops);
