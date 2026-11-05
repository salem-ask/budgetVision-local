# CLAUDE.md — BudgetVision, version locale

Application web mobile-first, installable (PWA), entièrement hors ligne, **sans compte, sans serveur, sans
synchronisation** : objectifs d'épargne, budget mensuel, règle 50/30/20, scénarios, historique. Devises CDF et USD.
Les données vivent uniquement dans IndexedDB du téléphone. Copie autonome de `salem-ask/Calculateur-Budget`
(version en ligne, avec comptes), dont elle importe les sauvegardes.
Publiée sur GitHub Pages : https://salem-ask.github.io/budgetVision-local/. Détails utilisateur : `README.md`.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm ci` | Installer les dépendances |
| `npm run dev` | Interface Vite sur :5173 |
| `npm run typecheck` | Types de tout le projet, tests compris |
| `npm test` | Tests (vitest) : calculs, sauvegarde |
| `npm run build` | Types sans les tests (`tsconfig.build.json`) puis compilation dans `dist/` |
| `npm run preview` | Sert `dist/` (service worker compris) |

**Avant chaque envoi : `npm run typecheck && npm test && npm run build`.** Le service worker (hors ligne)
n'existe que dans la version compilée. Chaque envoi sur `main` publie le site (`.github/workflows/pages.yml`).

## Architecture

```
src/
  domain/          calculs PURS et testés : goals, regularity, budget (50/30/20), scenarios, money, dates
  domain/types.ts  types métier : mêmes champs et identifiants que la version en ligne (ne pas renommer)
  data/db.ts       base Dexie « budgetvision-local », seedDefaults, wipeAllData
  data/store.ts    save / remove / removeGoal (seules écritures des écrans)
  data/backup.ts   sauvegarde : buildBackup, parseBackup (validation), importBackup (transaction unique), rappel
  ui/              App.tsx (coquille, navigation par #), screens/, BackupControls.tsx, storage.ts (persist), styles.css
tests/             domain, regularity, backup
```

## Règles à respecter

**Données locales uniquement.**
- Aucun appel réseau pour les données. Aucune dépendance serveur.
- Toute écriture passe par `save()` / `remove()` de `src/data/store.ts` (`save` pose `updatedAt`).
  Une suppression supprime vraiment l'élément (pas de pierre tombale, pas de champ `dirty`).
- Les catégories par défaut ont des identifiants fixes (`cat-…`), identiques à la version en ligne :
  ne pas les changer, sinon doublons à l'import.
- Nouveau champ ou nouveau type de donnée : l'ajouter aussi à la validation de `src/data/backup.ts`
  (sinon il est écarté à l'import), avec un test dans `tests/backup.test.ts`. Le format de sauvegarde
  (`version: 1`) doit rester compatible avec les fichiers « en-ligne ».
- Changement de schéma Dexie : nouvelle `version()` dans `db.ts`, jamais modifier la version 1.

**Calculs.** Toute règle de calcul va dans `src/domain/`, en fonction pure, avec un test dans `tests/`.
Les écrans ne font qu'afficher.

**Interface.**
- Tout en français, avec le **tutoiement**. Messages d'erreur clairs qui disent quoi corriger.
- Montants via `formatMoney` / `useMoney().fmt` : séparateur de milliers insécable (`1 250 000 CDF`),
  conversion dans la devise d'affichage avec le taux des réglages. Un montant ne se coupe jamais sur deux lignes.
- Mobile d'abord : vérifier à 360 px de large, aucun défilement horizontal, boutons d'au moins 48 px.
- Couleurs uniquement via les jetons CSS de `styles.css` (clair et sombre, `data-theme` compris).
- Pas de `confirm()` / `alert()` : `askConfirm()` de `components.tsx`, ou une confirmation dans la page.
- Partage de fichier (`navigator.share`) : l'appeler directement dans le toucher, sans `await` avant
  (la sauvegarde est préparée à l'avance par `ExportBackup`).
- Icônes : `Icon` de `src/ui/icons.tsx` (SVG). Logo : `src/ui/assets/logo-mark*.webp`.

## Déploiement

- GitHub Pages, source « GitHub Actions » (Settings → Pages). `base: './'` + navigation par `#` :
  fonctionne dans le sous-dossier `/budgetVision-local/`.
- Ne jamais committer `dist/`, `.env`, ni de fichier `budgetvision-sauvegarde-*.json` (données personnelles).
