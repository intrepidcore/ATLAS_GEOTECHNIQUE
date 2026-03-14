BEGIN;

ALTER TABLE atlas.colab_maille_assignments
  DROP CONSTRAINT IF EXISTS uq_colab_maille_assignments_maille_id;

ALTER TABLE atlas.colab_maille_assignments
  ADD CONSTRAINT uq_colab_maille_assignments_maille_id UNIQUE (maille_id);

COMMENT ON TABLE atlas.colab_maille_assignments IS 'BM-02 : Attribution administrative explicite étudiant → maille. Intentionnellement peuplée uniquement par des actions administratives (hors flux mission). Ne pas confondre avec colab_mission_assignments (source des mailles actives BM-08). Une maille ne peut avoir qu''une attribution explicite (UNIQUE(maille_id)).';

COMMIT;
