-- Audit trail: every change to an audited table is written by a trigger to audit.log, attributed to the actor
-- set by withActor (shared/lib/db/client.ts), and hash-chained so editing or deleting a past row is detectable.
-- Sensitive columns are recorded by name only ({"redacted": true}), so the log holds no recoverable personal data
-- and erasing a person deletes the source rows without breaking the chain.
-- Runs as the owner role. The app role (bv_app) can only read the log.

CREATE SCHEMA audit;
--> statement-breakpoint
CREATE TABLE audit.log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL,
  actor_id text NOT NULL,
  actor_type text NOT NULL,
  request_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('I', 'U', 'D')),
  table_name text NOT NULL,
  row_id text NOT NULL,
  changed jsonb NOT NULL,
  prev_hash bytea NOT NULL,
  hash bytea NOT NULL
);
--> statement-breakpoint
-- The one definition of a row's hash, used by both the trigger and audit.verify(), so canonical form never has
-- to match across languages. A JSON array keeps fields unambiguous; time is rendered in UTC explicitly.
CREATE FUNCTION audit.row_digest(r audit.log) RETURNS bytea
LANGUAGE sql STABLE SET timezone = 'UTC' AS $$
  SELECT sha256(convert_to(jsonb_build_array(
    encode(r.prev_hash, 'hex'),
    to_char(r.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    r.actor_id, r.actor_type, r.request_id, r.action, r.table_name, r.row_id, r.changed
  )::text, 'UTF8'))
$$;
--> statement-breakpoint
-- Trigger arguments: the primary-key column, then the sensitive columns to redact.
-- VOLATILE on purpose: the chain head is read after taking the lock, in this statement's own snapshot.
CREATE FUNCTION audit.capture() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
SET timezone = 'UTC' AS $$
DECLARE
  -- A setting that was once set reads '' (not NULL) later on the same pooled connection.
  v_actor text := nullif(current_setting('app.actor_id', true), '');
  v_type text := coalesce(nullif(current_setting('app.actor_type', true), ''), 'user');
  v_request text := coalesce(nullif(current_setting('app.request_id', true), ''), 'none');
  v_pk text := TG_ARGV[0];
  v_sensitive text[] := TG_ARGV[1:];
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_changed jsonb := '{}'::jsonb;
  v_keys text[] := '{}';
  v_key text;
  r audit.log;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'audit: audited writes must run in READ COMMITTED (the hash chain would fork)';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(coalesce(v_new, v_old)) LOOP
    IF (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
      v_keys := v_keys || v_key;
      v_changed := v_changed || jsonb_build_object(v_key,
        CASE WHEN v_key = ANY (v_sensitive) THEN jsonb_build_object('redacted', true)
             ELSE jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key) END);
    END IF;
  END LOOP;
  IF TG_OP = 'UPDATE' AND v_changed = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  IF v_actor IS NULL THEN
    -- Better Auth writes sign-up and profile fields outside withActor. Allow exactly that, attributed to the
    -- user themself; a role change or deletion without an actor would let privilege changes look self-made.
    IF TG_TABLE_NAME = 'user' AND (
         (TG_OP = 'INSERT' AND v_new ->> 'role' = 'patient')
      OR (TG_OP = 'UPDATE' AND v_keys <@ ARRAY['email_verified', 'name', 'image', 'email', 'updated_at'])
    ) THEN
      v_actor := coalesce(v_new, v_old) ->> 'id';
      v_type := 'auth';
    ELSE
      RAISE EXCEPTION 'audit: % on % without an actor (write through withActor)', TG_OP, TG_TABLE_NAME;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(4242001::bigint); -- same key as withActor
  SELECT l.hash INTO r.prev_hash FROM audit.log l ORDER BY l.id DESC LIMIT 1;
  r.prev_hash := coalesce(r.prev_hash, decode(repeat('00', 32), 'hex'));
  r.at := clock_timestamp();
  r.actor_id := v_actor;
  r.actor_type := v_type;
  r.request_id := v_request;
  r.action := left(TG_OP, 1);
  r.table_name := TG_TABLE_NAME;
  r.row_id := coalesce(v_new, v_old) ->> v_pk;
  r.changed := v_changed;
  r.hash := audit.row_digest(r);
  INSERT INTO audit.log (at, actor_id, actor_type, request_id, action, table_name, row_id, changed, prev_hash, hash)
  VALUES (r.at, r.actor_id, r.actor_type, r.request_id, r.action, r.table_name, r.row_id, r.changed, r.prev_hash, r.hash);
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION audit.forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit.log is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER no_update_or_delete BEFORE UPDATE OR DELETE ON audit.log FOR EACH ROW EXECUTE FUNCTION audit.forbid_change();
--> statement-breakpoint
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON audit.log FOR EACH STATEMENT EXECUTE FUNCTION audit.forbid_change();
--> statement-breakpoint
-- Walks the chain in id order. Returns how many rows check out, the first bad row (or NULL), and the head hash
-- to record outside the database (anchoring): tamper evidence holds back to the last recorded head.
CREATE FUNCTION audit.verify() RETURNS TABLE (checked bigint, first_bad_id bigint, head_hash text)
LANGUAGE plpgsql STABLE SET timezone = 'UTC' AS $$
DECLARE
  r audit.log;
  v_prev bytea := decode(repeat('00', 32), 'hex');
  v_n bigint := 0;
BEGIN
  FOR r IN SELECT * FROM audit.log ORDER BY id LOOP
    IF r.prev_hash <> v_prev OR r.hash <> audit.row_digest(r) THEN
      RETURN QUERY SELECT v_n, r.id, NULL::text;
      RETURN;
    END IF;
    v_prev := r.hash;
    v_n := v_n + 1;
  END LOOP;
  RETURN QUERY SELECT v_n, NULL::bigint, encode(v_prev, 'hex');
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public."user" FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'email', 'name', 'image');
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.cases FOR EACH ROW EXECUTE FUNCTION audit.capture('id');
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.case_clinical FOR EACH ROW EXECUTE FUNCTION audit.capture('case_id', 'ciphertext', 'iv', 'auth_tag');
--> statement-breakpoint
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.travelers FOR EACH ROW EXECUTE FUNCTION audit.capture('id', 'given_name', 'family_name', 'born_on');
--> statement-breakpoint
REVOKE ALL ON SCHEMA audit FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA audit FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA audit TO bv_app;
--> statement-breakpoint
GRANT SELECT ON audit.log TO bv_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION audit.verify(), audit.row_digest(audit.log) TO bv_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bv_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bv_app;
