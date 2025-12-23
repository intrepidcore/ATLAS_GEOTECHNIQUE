Un **journal de développement (dev log)** n’est **pas** un journal intime ni une doc technique classique. C’est une **boîte noire** : on doit pouvoir **reconstituer le raisonnement, les décisions et les causes des bugs**, même des mois plus tard (ou pour un jury).

Je te donne **une structure canonique**, utilisée en R&D, en thèse, et en ingénierie logicielle sérieuse — puis un **modèle prêt à copier**.

---

# 🎯 Objectif d’un journal dev (“boîte noire”)

Un journal dev sert à répondre à ces questions :

* ❓ *Qu’est-ce que j’ai essayé de faire ?*
* ❓ *Pourquoi cette décision plutôt qu’une autre ?*
* ❓ *Qu’est-ce qui a cassé ?*
* ❓ *Comment j’ai diagnostiqué ?*
* ❓ *Qu’est-ce que j’ai appris / figé comme règle ?*

👉 Il doit permettre :

* à **toi dans 6 mois** de comprendre
* à un **jury** de voir ta rigueur scientifique
* à un **collaborateur** de reprendre le projet

---

# 🧠 Principe clé : logique “boîte noire”

Tu ne racontes pas tout.
Tu consignes **ce qui a un impact sur le système**.

> **Entrée → Traitement → Sortie → Écart → Décision**

---

# 🧱 Structure recommandée (standard pro)

## 🗓️ En-tête (obligatoire)

```
Date :
Projet :
Version / branche :
Contexte (local / docker / prod) :
Auteur :
```

---

## 1️⃣ Contexte & intention

👉 **Pourquoi j’ouvre ce journal aujourd’hui**

* Fonctionnalité visée
* Bug observé
* Hypothèse initiale

**Exemple**

> Objectif : comprendre pourquoi l’export A4 est étiré malgré un bbox correct.

---

## 2️⃣ État initial du système (boîte noire)

👉 Ce que le système **fait réellement**, pas ce que tu crois

* UI : état visible
* Backend : endpoints appelés
* Données : volumes, formats
* Config : ports, SRID, env vars

**Exemple**

> UI Leaflet en 800×600 px, map fitBounds OK, export via html2canvas.

---

## 3️⃣ Hypothèses formulées (numérotées)

Très important : **séparer faits / hypothèses**

```
H1 – Le bbox est incorrect
H2 – Le container est redimensionné après fitBounds
H3 – html2canvas capture un canvas déjà transformé
```

👉 Ça montre ta **démarche scientifique**.

---

## 4️⃣ Expériences / actions menées

Pour chaque action :

```
Action A1 :
- Description :
- Fichier / fonction :
- Log ajouté :
- Résultat observé :
```

**Exemple**

> A1 : ajout d’un console.log des dimensions du container avant capture.

---

## 5️⃣ Observations factuelles

❗ Zéro interprétation ici

* Valeurs exactes
* Screenshots
* Logs
* Différences avant / après

**Exemple**

> Container = 1024×768 px avant fitBounds, 960×768 après resize.

---

## 6️⃣ Analyse & décision

👉 Là tu raisonnes

* Hypothèse confirmée / infirmée
* Cause racine identifiée
* Choix technique retenu

**Exemple**

> H2 confirmée. Le resize post-fitBounds provoque l’étirement à l’export.

---

## 7️⃣ Correctif appliqué / contournement

* Solution retenue
* Pourquoi celle-ci
* Impact sur l’existant
* Risques connus

**Exemple**

> Découplage resize UI / export. Export basé sur un container figé.

---

## 8️⃣ Règle figée / leçon apprise (très important)

C’est ce qui transforme ton dev en **recherche**.

> **Règle** : ne jamais appeler `fitBounds()` avant un resize dynamique.

---

## 9️⃣ État final & suite

* Statut : résolu / partiel / à revoir
* Dette technique créée
* Next steps

---

# 📦 Format recommandé

Pour un projet comme **Atlas Géotechnique** :

* 📁 `docs/devlog/`
* 📄 Un fichier **par jour / par problème**
* Format :

  * `YYYY-MM-DD_export-map-A4.md`
  * Markdown (lisible, versionnable Git)

---

# 🧪 Exemple mini (copiable)

```md
## 2025-12-23 — Export carte A4 étiré

### Contexte
Objectif : corriger l’étirement de l’export PDF.

### Hypothèses
H1 : bbox incorrect
H2 : resize après fitBounds
H3 : html2canvas applique un scale

### Actions
A1 : log dimensions container
A2 : log bounds Leaflet

### Observations
- bounds corrects
- container redimensionné après fitBounds

### Analyse
H2 validée.

### Décision
Séparer le layout export du layout UI.

### Règle
Ne jamais coupler fitBounds et resize dynamique.

### Statut
Résolu
```

---

# 🧠 Ce que le jury voit quand tu fais ça

Ils voient :

* une **démarche scientifique**
* une **traçabilité**
* une **maîtrise de la complexité**
* un esprit **ingénieur / chercheur**, pas juste “codeur”

---

Si tu veux, au prochain message :

* je te fais un **template officiel “journal dev” prêt pour mémoire**
* ou je t’aide à **transformer tes discussions actuelles en vrais logs propres**
* ou je t’explique **comment citer ce journal dans un mémoire académique**
