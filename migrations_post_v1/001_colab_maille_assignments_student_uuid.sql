-- Post-v1 migration: make atlas.colab_maille_assignments.student_id a UUID FK to atlas.colab_students(id)
-- Root-cause fix for runtime errors like: operator does not exist: text = uuid

BEGIN;

-- Drop dependent views (will be recreated below)
DROP VIEW IF EXISTS atlas.v_colab_students_without_maille;
DROP VIEW IF EXISTS atlas.v_colab_maille_assignment_details;
DROP VIEW IF EXISTS atlas.v_colab_assignments_by_adm;

-- Convert student_id from TEXT (matricule) to UUID (colab_students.id)
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

    -- Add staging uuid column
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='atlas'
        AND table_name='colab_maille_assignments'
        AND column_name='student_id_uuid'
    ) THEN
      EXECUTE 'ALTER TABLE atlas.colab_maille_assignments ADD COLUMN student_id_uuid uuid';
    END IF;

    -- Migrate existing text student_id (matricule) to uuid via colab_students.matricule
    EXECUTE 'UPDATE atlas.colab_maille_assignments a '
      || 'SET student_id_uuid = cs.id '
      || 'FROM atlas.colab_students cs '
      || 'WHERE cs.matricule = a.student_id';

    -- Delete non convertible rows (matricule introuvable)
    EXECUTE 'DELETE FROM atlas.colab_maille_assignments WHERE student_id_uuid IS NULL';

    -- Replace column
    EXECUTE 'ALTER TABLE atlas.colab_maille_assignments ALTER COLUMN student_id_uuid SET NOT NULL';
    EXECUTE 'ALTER TABLE atlas.colab_maille_assignments DROP COLUMN student_id';
    EXECUTE 'ALTER TABLE atlas.colab_maille_assignments RENAME COLUMN student_id_uuid TO student_id';
  END IF;
END $$;

-- Ensure FK to colab_students exists
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
  sp.commentaire,
  sp.created_at,
  sp.updated_at
FROM atlas.colab_student_prefs sp
LEFT JOIN atlas.colab_students cs ON cs.matricule = sp.student_id
LEFT JOIN atlas.colab_maille_assignments a ON a.student_id = cs.id
WHERE a.assignment_id IS NULL;

COMMIT;
