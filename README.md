# BudgetVision — version locale

*Calcule • Planifie • Réalise tes objectifs* — le calculateur de budget, **sans compte, sans serveur, sans internet**.

Application web en français, pensée pour le téléphone, installable (PWA) et utilisable entièrement hors ligne :
objectifs d'épargne, budget mensuel, règle 50/30/20, scénarios d'épargne et historique des simulations.
Devises : **CDF et USD**, avec un taux de change modifiable à la main.

Toutes les données restent **uniquement dans le téléphone** (base IndexedDB du navigateur). Rien n'est envoyé
nulle part, sauf les fichiers de sauvegarde que tu exportes toi-même.

Adresse : **<https://salem-ask.github.io/budgetVision-local/>** (GitHub Pages).

- [Fonctionnalités](#fonctionnalités)
- [Installer l'appli sur le téléphone](#installer-lappli-sur-le-téléphone)
- [Récupérer les données de la version en ligne](#récupérer-les-données-de-la-version-en-ligne)
- [Sauvegarde et restauration](#sauvegarde-et-restauration)
- [Limites à connaître](#limites-à-connaître)
- [Développement](#développement)
- [Publication sur GitHub Pages](#publication-sur-github-pages)
- [Format du fichier de sauvegarde](#format-du-fichier-de-sauvegarde)

---

## Fonctionnalités

| Écran | Contenu |
| --- | --- |
| **Accueil** | Résumé du mois (revenus, dépenses, solde, taux d'épargne), objectifs en cours, outils de calcul (calculateur d'épargne, convertisseur CDF ⇄ USD, raccourcis), évolution de l'épargne sur 6 ou 12 mois, dernière simulation. Quand l'appli est vide : « Importer mes données de la version en ligne ». Rappel « Pense à sauvegarder tes données » si la dernière sauvegarde a plus de 30 jours. |
| **Objectifs** | Plusieurs objectifs, montant cible, date limite, capital initial, versement régulier (jour / semaine / mois). Montant à épargner par jour, semaine et mois, temps nécessaire, reste à réunir, progression, alertes. Versements et **suivi de régularité**. |
| **Budget** | Revenus et dépenses du mois par catégorie (catégories personnalisables), solde, reste par jour, taux d'épargne, camembert, **règle 50/30/20**. |
| **Scénarios** | Prudent / intermédiaire / ambitieux, graphique de l'évolution du capital, montant visé facultatif. |
| **Historique** | Enregistrer une simulation, la rouvrir, la supprimer, la partager sur WhatsApp. |
| **Réglages** | Devise d'affichage, taux de change, thème clair / sombre / auto, **Sauvegarde** (exporter, envoyer, importer), état de la protection du stockage, « Effacer toutes les données ». |

L'icône ronde en haut à droite ouvre les Réglages. Sous le logo : « Données enregistrées sur ce téléphone ».

## Installer l'appli sur le téléphone

**Android (Chrome)** :
1. Ouvre <https://salem-ask.github.io/budgetVision-local/> dans **Chrome**.
2. Menu **⋮** → **Installer l'application** (ou « Ajouter à l'écran d'accueil » → Installer).
3. L'icône BudgetVision apparaît sur l'écran d'accueil. L'appli s'ouvre en plein écran et fonctionne
   ensuite **sans internet**.

**iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

Ouvre l'appli au moins une fois avec internet : elle se met alors entièrement en mémoire. Les mises à jour
arrivent quand internet est disponible (bandeau « Nouvelle version disponible »).

> L'appli installée et le site ouvert dans Chrome partagent les mêmes données. En revanche, un autre
> navigateur (Firefox, Samsung Internet…) a ses propres données, séparées.

## Récupérer les données de la version en ligne

À faire **avant** la suppression du site en ligne :

1. Sur la version en ligne (avec ton compte) : **Réglages → Sauvegarde → « Exporter mes données »**.
   Tu obtiens un fichier `budgetvision-sauvegarde-AAAA-MM-JJ.json` (dans Téléchargements, ou envoyé
   sur WhatsApp avec « Envoyer le fichier »).
2. Dans la version locale : sur l'Accueil, **« Importer mes données de la version en ligne »**
   (ou Réglages → Sauvegarde → « Importer une sauvegarde »), puis choisis ce fichier.
3. L'appli affiche un résumé (« Sauvegarde du 5 nov. 2026, compte awa : 3 objectifs, 12 versements… »).
   Touche **Remplacer**.

Tout est importé tel quel : objectifs, versements, lignes de budget, catégories (y compris renommées ou
personnalisées), historique et réglages (taux de change, devise d'affichage, scénarios).

## Sauvegarde et restauration

- **Exporter mes données** : télécharge le fichier de sauvegarde.
- **Envoyer le fichier (WhatsApp…)** : ouvre le partage du téléphone avec le fichier (si le téléphone le
  permet). Envoie-le-toi sur WhatsApp, dans Drive, par e-mail…
- **Importer une sauvegarde** : remplace **toutes** les données du téléphone par celles du fichier, après
  confirmation. Le fichier est vérifié avant : un fichier d'une autre appli ou abîmé est refusé avec un
  message clair, et rien n'est modifié.
- La date de la dernière sauvegarde est affichée dans Réglages. Après un import, c'est la date du fichier
  importé.

**Conseil** : exporte une sauvegarde au moins une fois par mois et garde-la hors du téléphone.

## Limites à connaître

- Les données sont **liées au navigateur du téléphone**. Elles sont perdues si tu désinstalles Chrome,
  effaces les données du site (« Effacer les données de navigation » → « Cookies et données des sites »),
  réinitialises ou perds le téléphone. **Seul le fichier de sauvegarde permet de les retrouver.**
- Pas de synchronisation entre plusieurs téléphones : pour passer à un autre téléphone, exporte puis
  importe le fichier.
- Au démarrage, l'appli demande au navigateur de **protéger le stockage** contre l'effacement automatique
  (Réglages → Données du téléphone indique s'il est protégé). Chrome l'accorde en général quand l'appli
  est installée ou souvent utilisée.

## Développement

Prérequis : Node.js 22.18 ou plus récent.

```bash
npm ci
npm run dev
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Interface en développement sur <http://localhost:5173> |
| `npm run typecheck` | Types de tout le projet, tests compris |
| `npm test` | Tests (vitest) : calculs, sauvegarde (validation, import, export) |
| `npm run build` | Types puis compilation dans `dist/` (avec le service worker) |
| `npm run preview` | Sert la version compilée (hors ligne compris) |

```
src/
  domain/          calculs PURS et testés : goals, regularity, budget (50/30/20), scenarios, money, dates ; types.ts
  data/db.ts       base Dexie (IndexedDB), valeurs par défaut, « tout effacer »
  data/store.ts    save / remove / removeGoal
  data/backup.ts   format de sauvegarde : export, validation, import, rappel
  ui/              App.tsx (coquille, navigation par #), screens/, BackupControls.tsx, storage.ts, styles.css
tests/             domain, regularity, backup
```

## Publication sur GitHub Pages

Le fichier `.github/workflows/pages.yml` vérifie (types, tests), compile et publie `dist/` à chaque envoi
sur la branche `main` (et à la demande, onglet Actions → « Publier sur GitHub Pages » → Run workflow).

Réglage à faire **une fois** : dépôt GitHub → **Settings → Pages → Build and deployment → Source :
GitHub Actions**.

GitHub Pages est gratuit pour un **dépôt public**. Pour un dépôt **privé**, il faut une offre payante
(GitHub Pro, Team ou Enterprise). Le site publié est de toute façon public, mais il ne contient aucune
donnée : les données ne quittent jamais le téléphone.

L'appli fonctionne dans le sous-dossier `/budgetVision-local/` grâce à `base: './'` (chemins relatifs) et à
la navigation par `#` : aucune règle serveur n'est nécessaire.

## Format du fichier de sauvegarde

```json
{
  "app": "BudgetVision",
  "version": 1,
  "exportedAt": "2026-11-05T17:44:00.000Z",
  "source": "locale",
  "data": {
    "goals": [], "contributions": [], "entries": [],
    "categories": [], "simulations": [], "settings": []
  }
}
```

`source` vaut `"en-ligne"` pour un fichier de la version avec compte (qui ajoute `"account"`, pour
information) et `"locale"` pour cette version. Chaque élément a les champs des types de
`src/domain/types.ts`, dont `id` et `updatedAt`. À l'import, les éléments `deleted: true` sont écartés et
les champs inconnus (`dirty`, etc.) ignorés.
