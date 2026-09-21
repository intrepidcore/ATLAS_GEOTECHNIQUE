-- Un envoi de masse ne part jamais sans décision humaine.
--
-- Le premier dispositif libérait l'envoi automatiquement dès que les paquets
-- étaient régénérés. C'est un défaut métier : 27 messages porteurs
-- d'identifiants partaient vers des personnes réelles sans que personne
-- n'appuie sur « envoyer », et sans fenêtre pour annuler après un mot de passe
-- mal attribué, une maille erronée ou un paquet suspect.
--
-- `awaiting_approval` matérialise cette étape. Le worker ne consomme que
-- `pending` ; seule une action explicite d'un administrateur fait la
-- transition, et elle est refusée tant que les paquets ne sont pas prêts.
ALTER TABLE atlas.colab_email_jobs DROP CONSTRAINT IF EXISTS colab_email_jobs_status_check;
ALTER TABLE atlas.colab_email_jobs ADD CONSTRAINT colab_email_jobs_status_check
  CHECK (status = ANY (ARRAY[
    'pending', 'awaiting_approval', 'running', 'completed', 'failed', 'cancelled'
  ]));
