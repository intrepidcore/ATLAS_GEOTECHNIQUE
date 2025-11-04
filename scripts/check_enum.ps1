docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'location_mode_enum'"
