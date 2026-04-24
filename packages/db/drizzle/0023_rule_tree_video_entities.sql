CREATE OR REPLACE FUNCTION pg_temp.obscura_rewrite_collection_rule_entity_types(node jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  rewritten jsonb;
  rewritten_entity_types jsonb;
  rewritten_children jsonb;
BEGIN
  IF node IS NULL OR jsonb_typeof(node) <> 'object' THEN
    RETURN node;
  END IF;

  rewritten := node;

  IF rewritten ? 'entityTypes' THEN
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN value = '"scene"'::jsonb THEN '"video"'::jsonb
          ELSE value
        END
        ORDER BY ord
      ),
      '[]'::jsonb
    )
    INTO rewritten_entity_types
    FROM jsonb_array_elements(rewritten -> 'entityTypes') WITH ORDINALITY AS t(value, ord);

    rewritten := jsonb_set(rewritten, '{entityTypes}', rewritten_entity_types, false);
  END IF;

  IF rewritten ? 'children' THEN
    SELECT COALESCE(
      jsonb_agg(pg_temp.obscura_rewrite_collection_rule_entity_types(value) ORDER BY ord),
      '[]'::jsonb
    )
    INTO rewritten_children
    FROM jsonb_array_elements(rewritten -> 'children') WITH ORDINALITY AS t(value, ord);

    rewritten := jsonb_set(rewritten, '{children}', rewritten_children, false);
  END IF;

  RETURN rewritten;
END;
$$;
--> statement-breakpoint
UPDATE "collections"
SET "rule_tree" = pg_temp.obscura_rewrite_collection_rule_entity_types("rule_tree")
WHERE "rule_tree" IS NOT NULL
  AND "rule_tree"::text LIKE '%"scene"%';
