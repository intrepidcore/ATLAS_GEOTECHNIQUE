# ATLAS – NOUVELLE DIRECTION STRATÉGIQUE & TECHNIQUE

**Version : 1.0**
**Confidentiel – Usage interne uniquement**

---

# 1. CONTEXTE

Atlas Géotechnique a initialement été conçu comme une application web locale évolutive vers un modèle SaaS.

Après analyse stratégique, technique et marché, la direction est réorientée vers :

> **La création d’un logiciel SIG professionnel desktop spécialisé en géotechnique**, installé en entreprise, avec une déclinaison web simplifiée ultérieure.

Cette décision vise :

* Une meilleure adéquation au marché local et institutionnel
* Une indépendance vis-à-vis du cloud
* Une simplification des phases de test
* Une maîtrise totale de la distribution et des données
* La construction d’un écosystème logiciel Atlas

---

# 2. VISION STRATÉGIQUE

## 2.1 Positionnement

Atlas devient :

> Un éditeur de solutions SIG spécialisées en géotechnique.

Atlas ne vise pas à concurrencer directement QGIS ni ArcGIS,
mais à devenir :

> Un outil métier spécialisé complémentaire, orienté analyse géotechnique avancée.

---

## 2.2 Produits cibles

L’écosystème Atlas s’organisera autour d’un moteur central unique :

### Atlas Core Engine (Rust)

Moteur géotechnique commun à tous les produits.

Produits dérivés :

1. **Atlas Geotech Pro** – Desktop professionnel
2. **Atlas Geotech Lite** – Version web simplifiée
3. Extensions futures : Atlas Survey, Atlas Collab, etc.

---

# 3. ARCHITECTURE CIBLE

## 3.1 Architecture logique

```
                Atlas Core Engine (Rust)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
 Atlas Pro        Atlas Lite Web       Atlas API
 (Desktop)         (Public)           (Services)
```

---

## 3.2 Stack technique retenue

### Moteur central

* Rust
* PostGIS (EPSG:25231 interne)
* GeoJSON export (EPSG:4326)
* Modules d’analyse géotechnique

### Interface Desktop (Phase 1)

* Tauri
* UI existante Vite + Leaflet
* WebView encapsulée

### Base de données

* PostgreSQL + PostGIS local
* Migration automatisée

---

# 4. NOUVELLE DIRECTION TECHNIQUE

## 4.1 Abandon de la priorité SaaS

Le SaaS n’est plus prioritaire.

Raisons :

* Marché local à faible maturité cloud
* Sensibilité des données géotechniques
* Dépendance à la connectivité internet
* Coûts d’hébergement
* Complexité DevOps

Le SaaS devient une éventuelle extension future, non prioritaire.

---

## 4.2 Priorité : Atlas Geotech Pro (Desktop)

### Objectif

Créer un logiciel SIG professionnel installé en entreprise.

### Caractéristiques clés

* Exécutable Windows (.exe)
* Fonctionnement offline
* Moteur Rust natif
* Analyse avancée
* Export professionnel
* Gestion de projets
* Système de licence

---

# 5. PLAN DE PHASES

---

# PHASE 1 — Stabilisation & Emballage Desktop

**Horizon : Master + 6 mois**

### Objectifs

* Stabiliser Atlas Core
* Emballer l’application avec Tauri
* Produire Atlas Pro v1.0 Desktop

### Actions techniques

* Intégration Tauri
* Maintien API locale HTTP (transitoire)
* Packaging Windows
* Système de logs local
* Simplification déploiement

### Résultat attendu

Atlas Pro v1.0 installable et testable par bêta-testeurs.

---

# PHASE 2 — Professionnalisation

**Horizon : 1–2 ans**

### Objectifs

* Suppression progressive dépendance HTTP interne
* Appels directs Rust via Tauri
* Optimisation performances
* UX professionnelle
* Gestion avancée des projets

### Ajouts

* Gestion des licences
* Modules premium
* Documentation technique officielle

---

# PHASE 3 — Structuration commerciale

### Objectifs

* Mise en place modèle économique
* Licence annuelle entreprise
* Licence académique
* Support technique structuré

---

# PHASE 4 — Atlas Lite Web

### Objectif

Créer une version web simplifiée destinée :

* Particuliers
* Étudiants
* Promoteurs immobiliers

### Fonctions limitées

* Analyse basique
* Rapport simplifié
* Paiement à l’analyse

⚠️ Important :
La version Lite ne doit jamais concurrencer la version Pro.

---

# 6. MODÈLE ÉCONOMIQUE PRÉVISIONNEL

## Atlas Pro

* Licence annuelle entreprise
* Licence académique
* Modules complémentaires payants

## Atlas Lite

* Paiement par analyse
* Abonnement étudiant
* Rapport premium

---

# 7. PRINCIPES DIRECTEURS

1. Un seul moteur technique central.
2. Priorité à la robustesse.
3. Performance avant design.
4. Architecture modulaire.
5. Ne jamais multiplier les produits prématurément.
6. Construire un produit fort avant un écosystème.

---

# 8. RISQUES IDENTIFIÉS

* Dispersion stratégique
* Complexité multi-produits
* Charge maintenance élevée
* Gestion mises à jour Desktop
* Support utilisateur

Mesure préventive :
Focus strict sur Atlas Pro jusqu’à maturité.

---

# 9. POSITIONNEMENT LONG TERME

Atlas vise à devenir :

> Une solution SIG géotechnique spécialisée, de référence régionale, installée en entreprise.

Le développement futur pourra inclure :

* Modules d’analyse avancée
* Collecte terrain (Atlas Survey)
* Collaboration projet (Atlas Collab)
* API technique pour intégration tierce

---

# 10. CONCLUSION

La nouvelle direction d’Atlas repose sur :

* Abandon de la priorité SaaS
* Priorité au Desktop professionnel
* Construction d’un moteur central robuste
* Déploiement progressif d’un écosystème

Stratégie retenue :

> Construire une forteresse technique (Atlas Pro),
> puis étendre l’écosystème autour d’un cœur stable.

---

**Fin du document – Usage interne uniquement**
