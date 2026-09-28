# 🌳 Arbre Généalogique — React (TypeScript) + api.php

Conversion de l'ancienne version (HTML/CSS/JS vanilla) en projet React (Create React App, TypeScript).
**`api.php` est conservé tel quel** : React ne fait qu'appeler ses actions (`login`, `load`, `add`, `update`, `delete`, `save_settings`, `import`, `clear_all`).

## Structure de `src/`

| Dossier / fichier | Rôle (ancien équivalent) |
|---|---|
| `services/api.ts` | Appels typés vers api.php (`apiCall`) |
| `services/treeLayout.ts` | Algorithme de placement, générations, dates (`layoutTree`, `getGen`…) |
| `services/themes.ts` | Thèmes de couleurs + variables CSS (`THEMES`, `applyTheme`) |
| `services/imageCompression.ts` | Compression canvas des photos |
| `context/AppContext.tsx` | État global : membres, paramètres, auth, toast |
| `hooks/usePanZoom.ts` | Pan, zoom molette, « Centrer » |
| `components/` | Header, LegendBar, TreeCanvas (SVG), modales (membre, auth, détail, paramètres, export), PhotoUpload… |
| `pages/TreePage.tsx` | Page principale, orchestration des modales et de la connexion |
| `styles/app.css` | Ancien `style.css` (inchangé) |
| `types/` | Types `Member`, `Settings`, `ThemeDefinition` |

## Développement

```bash
npm install
php -S localhost:8000     # dans le dossier contenant api.php
npm start                 # http://localhost:3000
```

Le champ `"proxy": "http://localhost:8000"` du `package.json` redirige les appels `api.php`
vers le serveur PHP : même origine côté navigateur, donc les **cookies de session** (connexion) fonctionnent.

## Production

```bash
npm run build
```

Copiez le **contenu** de `build/` dans le même dossier que `api.php` sur le serveur
(`famille.db` sera créé automatiquement à côté). Les chemins relatifs (`api.php`) et la session fonctionnent alors sans configuration.

> Si le front est hébergé sur un autre domaine que `api.php`, il faudra adapter les en-têtes CORS de
> `api.php` (origine explicite + `Access-Control-Allow-Credentials: true`) et passer `credentials: 'include'`
> dans `services/api.ts`. `REACT_APP_API_URL` permet de changer l'URL de l'API.

## Sécurité

Les identifiants `wandji` / `password` sont toujours codés en dur dans `api.php` (version basique) : à changer avant toute mise en ligne.
