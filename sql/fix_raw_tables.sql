-- Adapter les tables RAW pour utiliser UUID au lieu de BIGINT

ALTER TABLE raw_lab_agt ALTER COLUMN echantillon_id TYPE UUID USING echantillon_id::text::uuid;
ALTER TABLE raw_lab_ags ALTER COLUMN echantillon_id TYPE UUID USING echantillon_id::text::uuid;
ALTER TABLE raw_lab_atterberg ALTER COLUMN echantillon_id TYPE UUID USING echantillon_id::text::uuid;

SELECT 'Tables RAW adaptées pour UUID' AS status;
