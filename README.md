# 🌳 Arbre Généalogique — PHP + SQLite

## Structure des fichiers

```
arbre-genealogique/
├── index.html     ← Interface (ne pas modifier)
├── style.css      ← Styles (ne pas modifier)
├── script.js      ← Logique JS (ne pas modifier)
├── api.php        ← Backend PHP — toutes les opérations BDD
├── famille.db     ← Créé AUTOMATIQUEMENT par PHP au 1er lancement
└── README.md
```

---

## Prérequis

| Besoin | Minimum |
|--------|---------|
| PHP    | 7.4+    |
| Extension PDO SQLite | Activée par défaut sur la plupart des hébergements |

Vérifier que SQLite est disponible :
```bash
php -m | grep -i sqlite
# doit afficher : pdo_sqlite
```

---

## Installation locale (XAMPP / Laragon / WAMP)

1. Copier le dossier dans `htdocs/` (XAMPP) ou `www/` (Laragon)
2. Ouvrir `http://localhost/arbre-genealogique/`
3. C'est tout — `famille.db` est créé automatiquement

**Sans serveur local** (PHP intégré) :
```bash
cd arbre-genealogique
php -S localhost:8000
# puis ouvrir http://localhost:8000
```

---

## Installation sur hébergement mutualisé (cPanel)

1. Uploader les fichiers via FTP dans `public_html/arbre/` (par exemple)
2. Vérifier que le dossier a les droits **755** et les fichiers **644**
3. Le fichier `famille.db` sera créé automatiquement avec les droits d'écriture

> ⚠️ Si `famille.db` ne se crée pas, donner les droits 775 au dossier :
> ```
> chmod 775 /home/user/public_html/arbre/
> ```

---

## Comment ça fonctionne

> Les actions CRUD sur les membres sont réservées aux utilisateurs connectés.
> Les boutons `Ajouter` et `Modifier` sont masqués avant authentification, et un bouton `Déconnexion` apparaît après connexion.

### Côté PHP (`api.php`)

Un seul fichier gère tout. Il reçoit des requêtes POST avec un champ `action` :

| Action          | Ce qu'elle fait                        |
|-----------------|----------------------------------------|
| `login`         | Authentifie l'utilisateur              |
| `load`          | Retourne tous les membres + paramètres |
| `add`           | Insère un nouveau membre               |
| `update`        | Met à jour un membre existant          |
| `delete`        | Supprime un membre                     |
| `save_settings` | Sauvegarde treeName, thème, orientation|
| `import`        | Importe un JSON complet                |
| `clear_all`     | Vide toute la table membres            |

Par défaut, le projet utilise des identifiants codés en dur dans `api.php` :
`wandji` / `password`. Ce comportement est à remplacer en production.

### Côté JS (`script.js`)

La fonction `apiCall()` est le pont entre le JS et PHP :
```js
const res = await apiCall('add', { member: { firstname: 'Jean', ... } });
```

Elle envoie un `fetch POST` vers `api.php` et retourne la réponse JSON.

La connexion est gérée localement dans le navigateur via `script.js`, et le backend `api.php` vérifie la session avant d'autoriser `add`, `update`, `delete`, `clear_all` et `import`.

---

## Base de données SQLite

Le fichier `famille.db` contient 2 tables :

### Table `membres`
| Colonne     | Type | Description                    |
|-------------|------|--------------------------------|
| id          | TEXT | ID unique (ex: `m1abc2def`)    |
| firstname   | TEXT | Prénom                         |
| lastname    | TEXT | Nom de famille                 |
| gender      | TEXT | 'M', 'F' ou 'N'               |
| birth       | TEXT | Date naissance (YYYY-MM-DD)    |
| birthplace  | TEXT | Lieu de naissance              |
| death       | TEXT | Date décès (NULL si vivant)    |
| deathplace  | TEXT | Lieu de décès                  |
| parent_id   | TEXT | ID du parent (NULL = racine)   |
| spouse_id   | TEXT | ID du conjoint (NULL = aucun)  |
| notes       | TEXT | Biographie / notes             |
| photo       | TEXT | URL ou base64 de la photo      |
| created_at  | TEXT | Horodatage création            |
| updated_at  | TEXT | Horodatage modification        |

### Table `parametres`
| cle         | valeur (exemple)    |
|-------------|---------------------|
| treeName    | "Ma Famille"        |
| theme       | "0"                 |
| orientation | "top"               |

---

## Partage entre plusieurs personnes

Puisque la base est sur le serveur, **tout le monde voit les mêmes données** en temps réel.

Pour protéger l'accès (éviter que n'importe qui modifie l'arbre), deux options simples :

### Option A — Mot de passe HTTP (.htaccess)
Créer un fichier `.htpasswd` via cPanel → "Password Protect Directories"

### Option B — Ajouter un token dans api.php
```php
// Dans api.php, ajouter en haut :
$TOKEN = 'mon_mot_de_passe_secret';
$received = $_SERVER['HTTP_X_TOKEN'] ?? $body['token'] ?? '';
if ($received !== $TOKEN) jsonError('Non autorisé', 401);

// Dans script.js, ajouter dans apiCall() :
headers: {
  'Content-Type': 'application/json',
  'X-Token': 'mon_mot_de_passe_secret'
}
```

> ℹ️ Par défaut, le projet utilise une authentification simple codée en dur dans `api.php` avec le nom d'utilisateur `wandji` et le mot de passe `password`. Changez-les immédiatement en production.

---

## Sauvegarder la base de données

Pour faire une sauvegarde, il suffit de copier `famille.db` — c'est un fichier standard SQLite lisible avec [DB Browser for SQLite](https://sqlitebrowser.org/) (gratuit).

---

## Dépannage

| Problème | Cause probable | Solution |
|----------|---------------|----------|
| Page blanche | PHP non activé | Vérifier que PHP tourne |
| "Impossible d'ouvrir la BDD" | Droits insuffisants | `chmod 775` sur le dossier |
| Données non sauvegardées | `api.php` inaccessible | Vérifier l'URL dans la console navigateur (F12) |
| Extension SQLite manquante | PHP sans PDO SQLite | Activer `extension=pdo_sqlite` dans `php.ini` |
