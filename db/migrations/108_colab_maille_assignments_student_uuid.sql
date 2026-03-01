-- Make colab_maille_assignments compatible with mission assignments (UUID student ids)

BEGIN;

-- Drop dependent views (will be recreated below)
DROP VIEW IF EXISTS atlas.v_colab_students_without_maille;
DROP VIEW IF EXISTS atlas.v_colab_maille_assignment_details;
DROP VIEW IF EXISTS atlas.v_colab_assignments_by_adm;

-- 1) Drop old FK to colab_student_prefs and convert student_id to UUID FK -> colab_students(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='atlas'
      AND table_name='colab_maille_assignments'
      AND column_name='student_id'
      AND data_type='text'
  ) THEN
    -- Drop FK if present
    IF EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_schema='atlas'
        AND table_name='colab_maille_assignments'
        AND constraint_type='FOREIGN KEY'
        AND constraint_name='fk_colab_maille_assignments_student'
    ) THEN
      EXECUTE 'ALTER TABLE atlas.colab_maille_assignments DROP CONSTRAINT fk_colab_maille_assignments_student';
    END IF;

    -- If a unique index on student_id exists, drop it (it blocks multiple mailles per student)
    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname='atlas'
        AND tablename='colab_maille_assignments'
        AND indexname='colab_maille_assignments_student_uidx'
    ) THEN
      EXECUTE 'DROP INDEX atlas.colab_maille_assignments_student_uidx';
    END IF;

    -- Migrate existing text student_id (matricule) to uuid via colab_students.matricule
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='atlas'
        AND table_name='colab_maille_assignments'
        AND column_name='student_id_uuid'
    ) THEN
      EXECUTE 'ALTER TABLE atlas.colab_maille_assignments ADD COLUMN student_id_uuid uuid';
    END IF;

    EXECUTE 'UPDATE atlas.colab_maille_assignments a '
      || 'SET student_id_uuid = cs.id '
      || 'FROM atlas.colab_students cs '
      || 'WHERE cs.matricule = a.student_id';

    -- Supprimer les lignes non convertibles (matricule introuvable)
    EXECUTE 'DELETE FROM atlas.colab_maille_assignments WHERE student_id_uuid IS NULL';

    -- Replace column
    EXECUTE 'ALTER TABLE atlas.colab_maille_assignments ALTER COLUMN student_id_uuid SET NOT NULL';
    EXECUTE 'ALTER TABLE atlas.colab_maille_assignments DROP COLUMN student_id';
    EXECUTE 'ALTER TABLE atlas.colab_maille_assignments RENAME COLUMN student_id_uuid TO student_id';
  END IF;
END $$;

-- Recreate FK to colab_students
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema='atlas'
      AND table_name='colab_maille_assignments'
      AND constraint_type='FOREIGN KEY'
      AND constraint_name='fk_colab_maille_assignments_student'
  ) THEN
    EXECUTE 'ALTER TABLE atlas.colab_maille_assignments ADD CONSTRAINT fk_colab_maille_assignments_student FOREIGN KEY (student_id) REFERENCES atlas.colab_students(id) ON DELETE CASCADE';
  END IF;
END $$;

-- Ensure unique per maille
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='atlas'
      AND tablename='colab_maille_assignments'
      AND indexname='colab_maille_assignments_maille_uidx'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX colab_maille_assignments_maille_uidx ON atlas.colab_maille_assignments(maille_id)';
  END IF;
END $$;

-- Recreate dependent views with new student_id type (uuid -> colab_students)

CREATE VIEW atlas.v_colab_assignments_by_adm AS
SELECT
  a.adm_code_used,
  sp.adm_niveau,
  count(DISTINCT a.student_id) AS nb_etudiants,
  count(DISTINCT a.maille_id) AS nb_mailles_attribuees,
  min(a.assigned_at) AS first_assignment,
  max(a.assigned_at) AS last_assignment
FROM atlas.colab_maille_assignments a
JOIN atlas.colab_students cs ON cs.id = a.student_id
JOIN atlas.colab_student_prefs sp ON sp.student_id = cs.matricule
GROUP BY a.adm_code_used, sp.adm_niveau
ORDER BY sp.adm_niveau, (count(DISTINCT a.student_id)) DESC;

CREATE VIEW atlas.v_colab_maille_assignment_details AS
SELECT
  a.assignment_id,
  a.student_id,
  sp.nom,
  sp.prenom,
  (sp.nom || ' '::text) || sp.prenom AS full_name,
  sp.telephone,
  sp.email,
  sp.adm_niveau,
  sp.adm_code_pref_1,
  sp.adm_code_pref_2,
  sp.adm_code_pref_3,
  a.adm_code_used,
  a.pref_rank_used,
  a.assigned_at,
  m.id AS maille_id,
  m.code AS maille_code,
  m.pref_code AS maille_pref_code,
  m.pref_name AS maille_pref_name,
  m.adm2_name AS maille_adm2_name,
  m.geom,
  st_xmin(m.geom::box3d) AS bbox_xmin,
  st_ymin(m.geom::box3d) AS bbox_ymin,
  st_xmax(m.geom::box3d) AS bbox_xmax,
  st_ymax(m.geom::box3d) AS bbox_ymax,
  st_x(st_centroid(m.geom)) AS centroid_x,
  st_y(st_centroid(m.geom)) AS centroid_y,
  st_area(m.geom) / 1000000.0::double precision AS area_km2,
  sp.user_id,
  u.username,
  u.first_name AS user_first_name,
  u.last_name AS user_last_name
FROM atlas.colab_maille_assignments a
JOIN atlas.colab_students cs ON cs.id = a.student_id
JOIN atlas.colab_student_prefs sp ON sp.student_id = cs.matricule
JOIN atlas.mailles m ON m.id = a.maille_id
LEFT JOIN atlas.users u ON sp.user_id = u.id;

CREATE VIEW atlas.v_colab_students_without_maille AS
SELECT
  sp.student_id,
  sp.nom,
  sp.prenom,
  sp.email,
  sp.telephone,
  sp.adm_niveau,
  sp.adm_code_pref_1,
  sp.adm_code_pref_2,
  sp.adm_code_pref_3,
  sp.created_at
FROM atlas.colab_student_prefs sp
LEFT JOIN atlas.colab_students cs
  ON cs.matricule = sp.student_id
  AND cs.deleted_at IS NULL
LEFT JOIN atlas.colab_maille_assignments a
  ON a.student_id = cs.id
WHERE a.assignment_id IS NULL
ORDER BY sp.created_at;

-- 2) Update sync function to use UUID student ids
CREATE OR REPLACE FUNCTION atlas.sync_colab_maille_assignment_for_maille(p_maille_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_uuid uuid;
  v_assigned_at timestamptz;
  v_adm_code_used text;
BEGIN
  SELECT
    cma.student_id,
    cma.assigned_at
  INTO v_student_uuid, v_assigned_at
  FROM atlas.colab_missions cm
  JOIN atlas.colab_mission_assignments cma
    ON cma.mission_id = cm.id
   AND cma.unassigned_at IS NULL
  WHERE cm.maille_id = p_maille_id
    AND cm.deleted_at IS NULL
  ORDER BY cma.assigned_at DESC
  LIMIT 1;

  IF v_student_uuid IS NULL THEN
    DELETE FROM atlas.colab_maille_assignments
    WHERE maille_id = p_maille_id;
    RETURN;
  END IF;

  -- adm_code_used is NOT NULL in the schema; we use a durable fallback value.
  v_adm_code_used := 'SYNC_FROM_MISSIONS';

  INSERT INTO atlas.colab_maille_assignments (
    maille_id,
    student_id,
    adm_code_used,
    pref_rank_used,
    assigned_at,
    assigned_by,
    notes
  ) VALUES (
    p_maille_id,
    v_student_uuid,
    v_adm_code_used,
    1,
    COALESCE(v_assigned_at, now()),
    NULL,
    'sync: from colab_missions + colab_mission_assignments'
  )
  ON CONFLICT (maille_id) DO UPDATE
  SET
    student_id = EXCLUDED.student_id,
    adm_code_used = EXCLUDED.adm_code_used,
    pref_rank_used = EXCLUDED.pref_rank_used,
    assigned_at = EXCLUDED.assigned_at,
    assigned_by = EXCLUDED.assigned_by,
    notes = EXCLUDED.notes;
END;
$$;

-- 3) Backfill
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT DISTINCT cm.maille_id
    FROM atlas.colab_missions cm
    WHERE cm.deleted_at IS NULL
      AND cm.maille_id IS NOT NULL
  ) LOOP
    PERFORM atlas.sync_colab_maille_assignment_for_maille(r.maille_id);
  END LOOP;
END $$;

COMMIT;
