# Gbaka

## Déploiement sur Render

1. Connecte le dépôt `djjoel12/Gbaka` dans Render et crée un service Web (branche `main`).
2. Dans les variables d'environnement du service, ajoute `MAPBOX_TOKEN` avec ton token Mapbox.
3. Le fichier `backend/render.yaml` contient `buildCommand: npm install && npm run build-frontend` — Render installera les dépendances et construira le frontend.
4. Si besoin, force un redeploy depuis l'UI Render (onglet Deploys).

Fichiers importants:
- `backend/render.yaml` — configuration du service Render
- `frontend/vite.config.js` — configuration Vite; le build sort dans `backend/public`
- `backend/.env.example` — exemple des variables d'environnement requises

Commande locale pour tester:
```bash
cd backend
npm install
npm run build-frontend
MAPBOX_TOKEN=ton_token npm start
```