import {
  ConversationMessage,
  DatasetResult,
  GeminiModelId,
  GeminiModelOption,
} from '@/types/explorer';

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

export interface SearchPlan {
  needsSearch: boolean;
  searchQuery: string;
  alternativeQuery?: string;
  formatFilter?: string;
}

export interface GeminiSynthesisResult {
  answer: string;
  followUpSuggestions: string[];
  interactionId?: string;
}

interface InteractionOutputPart {
  type?: string;
  text?: string;
}

interface GeminiInteractionResponse {
  id?: string;
  status?: string;
  outputs?: InteractionOutputPart[];
  error?: {
    message?: string;
    code?: number;
  };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

interface GeminiModelsListResponse {
  models?: Array<{
    name: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
}

function normalizeModelName(model: string): string {
  return model.trim().replace(/^models\//, '') || 'gemini-3.8-flash';
}

/**
 * Appelle en priorité la nouvelle Interactions API (/v1beta/interactions) recommandée par Google,
 * avec repli automatique sur generateContent si nécessaire.
 */
async function callGeminiInteraction(params: {
  apiKey: string;
  model: GeminiModelId;
  systemInstruction: string;
  userPrompt: string;
  previousInteractionId?: string | null;
  jsonSchema?: Record<string, unknown>;
}): Promise<{ text: string; interactionId?: string }> {
  const {
    apiKey,
    model,
    systemInstruction,
    userPrompt,
    previousInteractionId,
    jsonSchema,
  } = params;

  const cleanKey = apiKey.trim();
  const cleanModel = normalizeModelName(model);

  // 1. Appel via l'Interactions API (/v1beta/interactions)
  const interactionsUrl = `${GEMINI_API_ROOT}/interactions?key=${encodeURIComponent(
    cleanKey
  )}`;

  const interactionPayload: Record<string, unknown> = {
    model: cleanModel,
    system_instruction: systemInstruction,
    input: userPrompt,
  };

  if (previousInteractionId) {
    interactionPayload.previous_interaction_id = previousInteractionId;
  }

  if (jsonSchema) {
    interactionPayload.response_format = {
      type: 'text',
      mime_type: 'application/json',
      schema: jsonSchema,
    };
  }

  const response = await fetch(interactionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(interactionPayload),
  });

  if (response.ok) {
    const data: GeminiInteractionResponse = await response.json();
    const outputs = Array.isArray(data.outputs) ? data.outputs : [];

    // Filtre uniquement les blocs de texte finaux (ignore les blocs "thought" de raisonnement interne)
    const textParts = outputs
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text || '');

    const fallbackParts =
      textParts.length > 0
        ? textParts
        : outputs
            .filter((part) => part.type !== 'thought' && typeof part.text === 'string')
            .map((part) => part.text || '');

    const text = fallbackParts.join('').trim();
    if (text) {
      return { text, interactionId: data.id };
    }
  } else {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson: GeminiInteractionResponse = await response.json();
      if (errJson?.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // ignore parse failure
    }

    // Si l'erreur concerne la clé API, le quota ou un modèle retiré, on la remonte immédiatement
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      errorDetail.toLowerCase().includes('no longer available') ||
      errorDetail.toLowerCase().includes('api key')
    ) {
      throw new Error(`Erreur API Gemini : ${errorDetail}`);
    }

    // Sinon (ex. variante de schéma ou previous_interaction_id expiré), repli propre sur generateContent
    return callGenerateContentFallback({
      cleanKey,
      cleanModel,
      systemInstruction,
      userPrompt,
      jsonSchema,
    });
  }

  return callGenerateContentFallback({
    cleanKey,
    cleanModel,
    systemInstruction,
    userPrompt,
    jsonSchema,
  });
}

async function callGenerateContentFallback(params: {
  cleanKey: string;
  cleanModel: string;
  systemInstruction: string;
  userPrompt: string;
  jsonSchema?: Record<string, unknown>;
}): Promise<{ text: string; interactionId?: string }> {
  const { cleanKey, cleanModel, systemInstruction, userPrompt, jsonSchema } =
    params;

  const url = `${GEMINI_API_ROOT}/models/${encodeURIComponent(
    cleanModel
  )}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  // Aucun paramètre obsolète (ex: temperature) envoyé aux modèles Gemini 3.8+
  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
  };

  if (jsonSchema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: jsonSchema,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson: GeminiGenerateContentResponse = await response.json();
      if (errJson?.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(`Erreur API Gemini : ${errorDetail}`);
  }

  const data: GeminiGenerateContentResponse = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((p) => !p.thought)
    .map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Réponse vide renvoyée par Gemini.');
  }

  return { text };
}

function parseJsonSafely<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/**
 * Récupère dynamiquement la liste des modèles Gemini actifs pour la clé de l'utilisateur.
 */
export async function fetchAvailableGeminiModels(
  apiKey: string
): Promise<GeminiModelOption[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return [];

  const res = await fetch(
    `${GEMINI_API_ROOT}/models?key=${encodeURIComponent(cleanKey)}`
  );
  if (!res.ok) {
    throw new Error(`Impossible de lister les modèles (HTTP ${res.status})`);
  }

  const data: GeminiModelsListResponse = await res.json();
  const models = (data.models || [])
    .filter((m) => {
      const id = m.name.replace(/^models\//, '');
      const supportsText =
        !m.supportedGenerationMethods ||
        m.supportedGenerationMethods.includes('generateContent');
      return (
        supportsText &&
        id.startsWith('gemini-') &&
        !id.includes('embedding') &&
        !id.includes('tts') &&
        !id.includes('imagen') &&
        !id.startsWith('gemini-1.') &&
        !id.startsWith('gemini-2.')
      );
    })
    .map((m) => {
      const id = m.name.replace(/^models\//, '');
      return {
        id,
        label: m.displayName ? `${id} (${m.displayName})` : id,
      };
    });

  return models;
}

/**
 * Teste la validité d'une clé API Gemini et du modèle sélectionné via l'Interactions API.
 */
export async function testGeminiConnection(
  apiKey: string,
  model: GeminiModelId = 'gemini-3.8-flash'
): Promise<{ ok: boolean; message: string }> {
  try {
    const cleanModel = normalizeModelName(model);
    await callGeminiInteraction({
      apiKey,
      model: cleanModel,
      systemInstruction: 'Réponds uniquement par OK.',
      userPrompt: 'Ping',
    });
    return {
      ok: true,
      message: `Connexion Interactions API réussie avec ${cleanModel}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Clé API invalide ou modèle indisponible.',
    };
  }
}

const SEARCH_PLAN_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    needsSearch: { type: 'BOOLEAN' },
    searchQuery: { type: 'STRING' },
    alternativeQuery: { type: 'STRING' },
    formatFilter: { type: 'STRING' },
  },
  required: ['needsSearch', 'searchQuery'],
};

/**
 * Étape 1 du RAG : transforme la question conversationnelle de l'utilisateur
 * en une requête optimale pour le moteur de recherche data.gouv.fr.
 */
export async function planDataGouvSearch(params: {
  apiKey: string;
  model: GeminiModelId;
  userQuestion: string;
  history: ConversationMessage[];
  hasPreviousDatasets: boolean;
}): Promise<SearchPlan> {
  const { apiKey, model, userQuestion, history, hasPreviousDatasets } = params;

  const recentTurns = history
    .slice(-6)
    .map(
      (m) =>
        `${m.type === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content.slice(
          0,
          300
        )}`
    )
    .join('\n');

  const systemInstruction = `Tu es un expert du portail Open Data français data.gouv.fr.
Analyse la question de l'utilisateur et l'historique récent pour préparer la meilleure recherche sur l'API data.gouv.fr.

Réponds UNIQUEMENT au format JSON avec les clés :
- "needsSearch": booléen (true s'il faut chercher de nouveaux jeux de données ; false UNIQUEMENT si l'utilisateur pose une question de clarification directe sur les datasets déjà affichés).
- "searchQuery": 2 à 5 mots-clés français très précis adaptés au moteur de recherche data.gouv.fr (sans mots vides comme "jeux de données", "france", "trouver"). Utilise les acronymes officiels connus quand pertinent (ex: "bornes recharge IRVE", "valeurs foncières DVF", "recyclage déchets ADEME").
- "alternativeQuery": requête plus courte et plus générale (2-3 mots) au cas où searchQuery ne renvoie rien.
- "formatFilter": chaîne optionnelle ("csv", "json", "geojson", "parquet", "xlsx") UNIQUEMENT si l'utilisateur exige explicitement un format précis, sinon "".`;

  const userPrompt = `Historique récent :
${recentTurns || '(Début de conversation)'}

Datasets déjà présents dans le contexte : ${hasPreviousDatasets ? 'Oui' : 'Non'}

Nouvelle question de l'utilisateur :
"${userQuestion}"`;

  const { text } = await callGeminiInteraction({
    apiKey,
    model,
    systemInstruction,
    userPrompt,
    jsonSchema: SEARCH_PLAN_SCHEMA,
  });

  const parsed = parseJsonSafely<Partial<SearchPlan>>(text, {});
  return {
    needsSearch:
      typeof parsed.needsSearch === 'boolean'
        ? parsed.needsSearch || !hasPreviousDatasets
        : true,
    searchQuery: (parsed.searchQuery || userQuestion).trim(),
    alternativeQuery: parsed.alternativeQuery?.trim() || undefined,
    formatFilter: parsed.formatFilter?.trim() || undefined,
  };
}

const SYNTHESIS_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    followUpSuggestions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['answer', 'followUpSuggestions'],
};

/**
 * Étape 2 du RAG : synthétise une réponse claire, sourcée et utile via l'Interactions API
 * en maintenant l'état multi-tours côté serveur grâce à previous_interaction_id.
 */
export async function synthesizeWithGemini(params: {
  apiKey: string;
  model: GeminiModelId;
  userQuestion: string;
  searchQueryUsed: string;
  datasets: DatasetResult[];
  totalAvailable: number;
  history: ConversationMessage[];
  previousInteractionId?: string | null;
}): Promise<GeminiSynthesisResult> {
  const {
    apiKey,
    model,
    userQuestion,
    searchQueryUsed,
    datasets,
    totalAvailable,
    history,
    previousInteractionId,
  } = params;

  const recentTurns = history
    .slice(-6)
    .map(
      (m) =>
        `${m.type === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content.slice(
          0,
          400
        )}`
    )
    .join('\n');

  const datasetContext =
    datasets.length === 0
      ? 'Aucun jeu de données retourné par data.gouv.fr pour cette requête.'
      : datasets
          .slice(0, 6)
          .map((ds, idx) => {
            const resourcesSummary = (ds.resources || [])
              .slice(0, 3)
              .map((r) => `${r.title} (${r.format})`)
              .join(' ; ');
            return [
              `[Dataset #${idx + 1}]`,
              `Titre : ${ds.title}`,
              `Producteur : ${ds.organization?.name || 'Non spécifié'}${
                ds.organization?.isPublicService
                  ? ' (Service Public certifié)'
                  : ''
              }`,
              `URL : ${ds.uri}`,
              `Formats disponibles : ${
                (ds.formats || []).join(', ') || 'Non renseigné'
              }`,
              `Dernière mise à jour : ${
                ds.lastModified ? ds.lastModified.slice(0, 10) : 'Inconnue'
              }`,
              `Ressources principales : ${resourcesSummary || 'Voir fiche'}`,
              `Description : ${ds.description.slice(0, 500)}`,
            ].join('\n');
          })
          .join('\n\n---\n\n');

  const systemInstruction = `Tu es "DataGouv Explorer", un assistant expert en Open Data public français (data.gouv.fr).
Règles strictes :
1. Réponds toujours en français, de manière claire, structurée (Markdown avec titres courts, listes à puces et gras) et directement actionnable.
2. Appuie-toi UNIQUEMENT sur les jeux de données fournis dans le contexte ci-dessous. N'invente jamais d'URL ni de jeu de données fictif.
3. Cite les jeux de données les plus pertinents avec des liens Markdown cliquables [Titre du dataset](URL), en précisant qui les publie, quels formats (CSV, GeoJSON, Parquet, API...) sont disponibles et comment les exploiter concrètement.
4. Si aucun dataset du contexte ne correspond exactement, explique honnêtement ce qui s'en rapproche ou suggère une piste précise sur l'écosystème public français (INSEE, IGN, ADEME, transport.data.gouv.fr, geo.data.gouv.fr).
5. Réponds au format JSON strict contenant "answer" (Markdown) et "followUpSuggestions" (3 suggestions courtes).`;

  const userPrompt = `${
    !previousInteractionId && recentTurns
      ? `Historique de conversation :\n${recentTurns}\n\n`
      : ''
  }Question actuelle de l'utilisateur :
"${userQuestion}"

Requête exécutée sur data.gouv.fr : "${searchQueryUsed}" (${totalAvailable} résultats au total)

Jeux de données récupérés :
${datasetContext}`;

  const { text, interactionId } = await callGeminiInteraction({
    apiKey,
    model,
    systemInstruction,
    userPrompt,
    previousInteractionId,
    jsonSchema: SYNTHESIS_SCHEMA,
  });

  const parsed = parseJsonSafely<Partial<GeminiSynthesisResult>>(text, {});
  if (parsed.answer && typeof parsed.answer === 'string') {
    return {
      answer: parsed.answer,
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions)
        ? parsed.followUpSuggestions.slice(0, 3)
        : [],
      interactionId,
    };
  }

  return {
    answer: text,
    followUpSuggestions: [],
    interactionId,
  };
}
