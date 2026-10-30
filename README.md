# DataGouv Explorer

Interface conversationnelle minimaliste pour explorer les jeux de données publics français (**[data.gouv.fr](https://www.data.gouv.fr)**), propulsée par **Google Gemini (`gemini-3.8-flash` / Interactions API)**.

## Fonctionnement

- **Recherche temps réel sans serveur** : interroge directement l'API officielle `https://www.data.gouv.fr/api/1/datasets/`.
- **Synthèse IA avec Gemini** *(optionnelle)* : reformule votre question, synthétise les jeux de données pertinents et conserve le contexte de conversation via la nouvelle **Interactions API**.
- **Mode sans clé inclus** : fonctionne immédiatement en recherche directe si aucune clé Gemini n'est renseignée.

## Lancement

```bash
npm install
npm run dev
```

Ouvrez ensuite http://localhost:8080 et cliquez sur le bouton **Gemini** en haut à droite (ou définissez `VITE_GEMINI_API_KEY` dans `.env.local`) pour activer l'IA.

## Structure du projet

```text
src/
├── components/
│   ├── explorer/       # ChatMessage, DatasetModal, MarkdownContent, SettingsModal
│   └── ui/             # 8 composants UI essentiels (Button, Dialog, Input, Select, Sheet, Toast...)
├── hooks/
│   └── useExplorer.ts  # Logique de conversation et persistance localStorage
├── pages/
│   └── Index.tsx       # Vue principale épurée (colonne unique centrée)
├── services/
│   ├── datagouv.ts     # Client API officiel data.gouv.fr
│   └── gemini.ts       # Orchestrateur RAG Gemini Interactions API
└── types/
    └── explorer.ts     # Types TypeScript
```
