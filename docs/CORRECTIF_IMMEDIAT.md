# 🚨 CORRECTIF IMMÉDIAT - Failed to Fetch

## Étape 1 : Ouvrir la Console

1. Appuyez sur **F12** pour ouvrir les outils développeur
2. Allez dans l'onglet **Console**

## Étape 2 : Exécuter ce Code

Copiez-collez cette ligne dans la console et appuyez sur **Entrée** :

```javascript
localStorage.setItem('API_GEO', '/api'); location.reload();
```

## Étape 3 : Vérifier

Après le rechargement, dans la console vous devriez voir :

```
[INIT] API_GEO configuré: /api
```

Et dans l'onglet **Network**, les requêtes doivent partir vers :

```
http://localhost:8080/api/coverage/mailles
```

Au lieu de :

```
http://127.0.0.1:8080/coverage/mailles  ❌
```

---

## Si ça ne marche toujours pas

Le problème vient du code qui construit les URL sans utiliser `API_GEO`.

Vérifiez dans le code source où sont faites les requêtes vers `/coverage/mailles`.

Il faut chercher et remplacer :
```typescript
// ❌ Mauvais
fetch('/coverage/mailles')
fetch(`${location.origin}/coverage/mailles`)

// ✅ Bon
fetch(`${API_GEO}/coverage/mailles`)
// ou mieux
import { apiGet } from './api'
apiGet('/coverage/mailles')
```
