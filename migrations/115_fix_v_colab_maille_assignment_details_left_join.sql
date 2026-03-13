CREATE OR REPLACE VIEW atlas.v_colab_maille_assignment_details AS
SELECT
    a.assignment_id,
    a.student_id,

    COALESCE(sp.nom, u.last_name, u.username) AS nom,
    COALESCE(sp.prenom, u.first_name, '') AS prenom,
    COALESCE(
        NULLIF(TRIM(sp.nom || ' ' || sp.prenom), ''),
        NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
        u.username
    ) AS full_name,
    COALESCE(sp.telephone, u.telephone) AS telephone,
    COALESCE(sp.email, u.email) AS email,
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
    ST_XMin(m.geom) AS bbox_xmin,
    ST_YMin(m.geom) AS bbox_ymin,
    ST_XMax(m.geom) AS bbox_xmax,
    ST_YMax(m.geom) AS bbox_ymax,
    ST_X(ST_Centroid(m.geom)) AS centroid_x,
    ST_Y(ST_Centroid(m.geom)) AS centroid_y,

    ST_Area(m.geom) / 1000000.0 AS area_km2,

    cs.user_id,
    u.username,
    u.first_name AS user_first_name,
    u.last_name AS user_last_name

FROM atlas.colab_maille_assignments a
JOIN atlas.mailles m ON m.id = a.maille_id
LEFT JOIN atlas.colab_student_prefs sp ON sp.student_id = a.student_id::text
LEFT JOIN atlas.colab_students cs ON cs.id::text = a.student_id::text AND cs.deleted_at IS NULL
LEFT JOIN atlas.users u ON u.id = cs.user_id AND u.deleted_at IS NULL;
