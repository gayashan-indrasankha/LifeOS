CREATE FUNCTION lifeos_notify_change() RETURNS trigger AS $$
DECLARE
  row_data jsonb;
  message jsonb;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  message := jsonb_build_object('userId', row_data->>'user_id', 'table', TG_TABLE_NAME);
  IF TG_TABLE_NAME = 'habit_entries' THEN
    message := message || jsonb_build_object(
      'habitId', row_data->>'habit_id',
      'date', row_data->>'date',
      'completed', CASE WHEN TG_OP = 'DELETE' THEN false ELSE (row_data->>'completed')::boolean END
    );
  END IF;
  PERFORM pg_notify('lifeos_changes', message::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'user_id'
      AND table_name NOT IN ('account', 'session')
  LOOP
    EXECUTE format(
      'CREATE TRIGGER lifeos_change_notify AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION lifeos_notify_change()',
      item.table_name
    );
  END LOOP;
END;
$$;
