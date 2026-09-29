# La Kantoche 57 — mini-site

Site de présentation de l'offre de restauration **La Kantoche 57** pour Saint-Luc Bruxelles.
Site statique (HTML/CSS), sans build ni dépendances.

## Pages
- `index.html` — présentation du projet (concept, 2 phases, app de commande, engagements, équipe, contact)
- `menu.html` — la carte complète et le menu catering

## Déploiement sur Vercel

### Via GitHub (recommandé)
1. Créer un repo GitHub et y pousser ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Kantoche 57 — mini-site"
   git branch -M main
   git remote add origin https://github.com/<utilisateur>/kantoche-57.git
   git push -u origin main
   ```
2. Sur [vercel.com](https://vercel.com) → **Add New → Project** → importer le repo.
3. Framework preset : **Other** (aucun build). Vercel sert directement les fichiers.
4. Deploy. Chaque `git push` redéploie automatiquement.

### Sans GitHub (Vercel CLI)
```bash
npm i -g vercel
vercel        # suivre les invites
vercel --prod # mise en production
```

## Personnalisation
- Couleurs et typo : `assets/style.css` (variables `:root` en haut).
- Logos : `assets/`.
- Contact : bas de `index.html`.

Palette dérivée de la charte ESA St-Luc BXL (teintes adoucies), signature rouge brique.
