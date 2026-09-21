// ============================================================================
// Module: Import Bulk - Complet selon cahier des charges
// ============================================================================
// Description: Gestion complète de l'import bulk de sondages géotechniques
// Version: 1.0
// Date: 2025-10-19
// Référence: docs/CAHIER_CHARGES_IMPORT_BULK.md
// ============================================================================

pub mod geotechnical_importer;
pub mod importer;
pub mod job_queue;
pub mod matcher;
pub mod parser;
pub mod routes;
pub mod transformer;
pub mod types;
pub mod validator;
pub mod xlsx_parser;

#[cfg(test)]
mod tests;

pub use routes::configure;

/// Replie les diacritiques latins sur leur lettre de base.
///
/// Indispensable ici : sans ce repli, « Adjengré » et « Adjengre » produisent
/// deux codes d'enquête distincts, et « très forte » et « tres forte » deux
/// modalités distinctes en base pour la même observation de terrain. Aucune
/// dépendance externe : seule la plage latine effectivement rencontrée dans la
/// toponymie togolaise et le vocabulaire géotechnique français est traitée.
pub fn fold_diacritics(input: &str) -> String {
    input
        .chars()
        .map(|c| match c {
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' => 'a',
            'À' | 'Á' | 'Â' | 'Ã' | 'Ä' | 'Å' => 'A',
            'è' | 'é' | 'ê' | 'ë' => 'e',
            'È' | 'É' | 'Ê' | 'Ë' => 'E',
            'ì' | 'í' | 'î' | 'ï' => 'i',
            'Ì' | 'Í' | 'Î' | 'Ï' => 'I',
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' => 'o',
            'Ò' | 'Ó' | 'Ô' | 'Õ' | 'Ö' => 'O',
            'ù' | 'ú' | 'û' | 'ü' => 'u',
            'Ù' | 'Ú' | 'Û' | 'Ü' => 'U',
            'ý' | 'ÿ' => 'y',
            'Ý' => 'Y',
            'ñ' => 'n',
            'Ñ' => 'N',
            'ç' => 'c',
            'Ç' => 'C',
            other => other,
        })
        .collect()
}

#[cfg(test)]
mod fold_tests {
    use super::fold_diacritics;

    #[test]
    fn replie_les_accents_francais_et_conserve_le_reste() {
        assert_eq!(fold_diacritics("Adjengré"), "Adjengre");
        assert_eq!(fold_diacritics("très forte"), "tres forte");
        assert_eq!(fold_diacritics("Çà et là"), "Ca et la");
        assert_eq!(fold_diacritics("Sokodé-Kara 12"), "Sokode-Kara 12");
        assert_eq!(fold_diacritics("sans accent"), "sans accent");
    }
}
