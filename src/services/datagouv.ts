import { DatasetResource, DatasetResult } from '@/types/explorer';

const DATAGOUV_API_BASE = 'https://www.data.gouv.fr/api/1';

const FRENCH_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux',
  'et', 'ou', 'mais', 'donc', 'car', 'ni', 'or', 'dans', 'sur', 'sous',
  'avec', 'sans', 'pour', 'par', 'en', 'vers', 'chez', 'entre', 'depuis',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'te', 'se', 'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
  'ce', 'cet', 'cette', 'ces', 'qui', 'que', 'quoi', 'dont', 'où',
  'quel', 'quelle', 'quels', 'quelles', 'comment', 'combien', 'pourquoi',
  'est', 'sont', 'être', 'etre', 'avoir', 'peux', 'peut', 'pouvez', 'veux', 'voudrais',
  'cherche', 'chercher', 'trouve', 'trouver', 'donne', 'donner', 'montre', 'montrer',
  'parle', 'parlent', 'concernant', 'relatif', 'relatifs', 'existe', 'plus', 'moins',
  'jeu', 'jeux', 'donnée', 'donnee', 'données', 'donnees', 'dataset', 'datasets',
  'fichier', 'fichiers', 'base', 'bases', 'catalogue', 'publique', 'publiques', 'public', 'publics',
  'france', 'français', 'francais', 'française', 'francaise', 'disponible', 'disponibles',
]);

interface RawDataGouvResource {
  id: string;
  title?: string;
  format?: string;
  url?: string;
  filesize?: number;
}

interface RawDataGouvDataset {
  id: string;
  title: string;
  description?: string;
  page?: string;
  slug?: string;
  last_update?: string;
  last_modified?: string;
  organization?: {
    name: string;
    badges?: Array<{ kind: string }>;
  } | null;
  resources?: RawDataGouvResource[];
}

interface RawDataGouvResponse {
  data: RawDataGouvDataset[];
  total: number;
}

export function extractFrenchSearchQuery(userInput: string): string {
  const words = userInput
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !FRENCH_STOPWORDS.has(word));

  return words.length > 0 ? words.slice(0, 6).join(' ') : userInput.trim();
}

function cleanDescription(raw?: string): string {
  if (!raw) return 'Aucune description fournie.';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeFormat(fmt?: string): string {
  if (!fmt) return '';
  const cleaned = fmt.toUpperCase().replace(/^\./, '').trim();
  if (cleaned.length > 10 || cleaned.includes('/')) {
    for (const known of ['CSV', 'JSON', 'PARQUET', 'GEOJSON', 'XLSX', 'PDF', 'ZIP']) {
      if (cleaned.includes(known)) return known;
    }
    return '';
  }
  return cleaned;
}

function mapRawDataset(item: RawDataGouvDataset): DatasetResult {
  const rawResources = Array.isArray(item.resources) ? item.resources : [];

  const resources: DatasetResource[] = rawResources
    .filter((r) => Boolean(r.url))
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      title: r.title || 'Ressource',
      format: normalizeFormat(r.format) || 'FICHIER',
      url: r.url || '',
      filesize: r.filesize,
    }));

  const formatSet = new Set<string>();
  for (const r of rawResources) {
    const fmt = normalizeFormat(r.format);
    if (fmt) formatSet.add(fmt);
  }

  return {
    id: item.id,
    title: item.title,
    description: cleanDescription(item.description),
    uri:
      item.page ||
      (item.slug
        ? `https://www.data.gouv.fr/fr/datasets/${item.slug}/`
        : 'https://www.data.gouv.fr'),
    organization: item.organization
      ? {
          name: item.organization.name,
          isPublicService: Boolean(
            item.organization.badges?.some(
              (b) => b.kind === 'public-service' || b.kind === 'certified'
            )
          ),
        }
      : undefined,
    formats: Array.from(formatSet).slice(0, 4),
    resources,
    lastModified: item.last_update || item.last_modified,
  };
}

const OFFLINE_DEMO_DATASETS: DatasetResult[] = [
  {
    id: 'dvf',
    title: 'Demandes de valeurs foncières (DVF)',
    description:
      'Transactions immobilières (ventes de maisons, appartements et terrains) intervenues au cours des cinq dernières années en France.',
    uri: 'https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/',
    organization: { name: 'DGFiP — Ministère des Finances', isPublicService: true },
    formats: ['CSV', 'TXT', 'PARQUET'],
  },
  {
    id: 'irve',
    title: 'Bornes de Recharge pour Véhicules Électriques (IRVE)',
    description:
      'Base nationale consolidée des infrastructures de recharge publique pour véhicules électriques en France.',
    uri: 'https://www.data.gouv.fr/fr/datasets/fichier-consolide-des-bornes-de-recharge-pour-vehicules-electriques/',
    organization: { name: 'transport.data.gouv.fr', isPublicService: true },
    formats: ['CSV', 'GEOJSON'],
  },
  {
    id: 'ban',
    title: 'Base Adresse Nationale (BAN)',
    description:
      'Référentiel officiel de toutes les adresses géolocalisées en France.',
    uri: 'https://www.data.gouv.fr/fr/datasets/base-adresse-nationale/',
    organization: { name: 'IGN / ANCT', isPublicService: true },
    formats: ['CSV', 'GEOJSON', 'API'],
  },
];

export interface DataGouvSearchResult {
  datasets: DatasetResult[];
  total: number;
  effectiveQuery: string;
  isDemoFallback: boolean;
}

async function queryDataGouvEndpoint(
  query: string,
  pageSize: number,
  formatFilter?: string
): Promise<RawDataGouvResponse> {
  const params = new URLSearchParams({
    q: query,
    page_size: String(pageSize),
  });
  if (formatFilter) params.set('format', formatFilter.toLowerCase());

  const res = await fetch(`${DATAGOUV_API_BASE}/datasets/?${params.toString()}`);
  if (!res.ok) throw new Error(`Erreur API data.gouv.fr (${res.status})`);
  return res.json();
}

export async function searchDataGouv(
  primaryQuery: string,
  options?: {
    alternativeQuery?: string;
    formatFilter?: string;
    pageSize?: number;
  }
): Promise<DataGouvSearchResult> {
  const cleanPrimary = primaryQuery.trim() || 'france statistiques';
  const pageSize = options?.pageSize ?? 5;

  try {
    let raw = await queryDataGouvEndpoint(
      cleanPrimary,
      pageSize,
      options?.formatFilter
    );
    let effectiveQuery = cleanPrimary;

    if (raw.data.length === 0 && options?.alternativeQuery?.trim()) {
      const alt = options.alternativeQuery.trim();
      raw = await queryDataGouvEndpoint(alt, pageSize);
      effectiveQuery = alt;
    }

    if (raw.data.length === 0) {
      const words = cleanPrimary.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 2) {
        const broader = words.slice(0, 2).join(' ');
        raw = await queryDataGouvEndpoint(broader, pageSize);
        effectiveQuery = broader;
      }
    }

    return {
      datasets: raw.data.map(mapRawDataset),
      total: raw.total ?? raw.data.length,
      effectiveQuery,
      isDemoFallback: false,
    };
  } catch {
    return {
      datasets: OFFLINE_DEMO_DATASETS,
      total: OFFLINE_DEMO_DATASETS.length,
      effectiveQuery: cleanPrimary,
      isDemoFallback: true,
    };
  }
}

export function buildDirectSynthesis(
  searchQuery: string,
  datasets: DatasetResult[],
  total: number,
  isDemoFallback: boolean
): { answer: string; followUpSuggestions: string[] } {
  if (datasets.length === 0) {
    return {
      answer: `Aucun jeu de données trouvé sur **data.gouv.fr** pour *« ${searchQuery} »*. Essayez avec des mots-clés plus généraux.`,
      followUpSuggestions: [
        'Valeurs foncières immobilières (DVF)',
        'Bornes de recharge véhicules électriques',
      ],
    };
  }

  const intro = isDemoFallback
    ? `> Mode hors-ligne activé — voici des exemples de jeux de données disponibles :`
    : `Voici les principaux résultats parmi **${total.toLocaleString('fr-FR')} jeux de données** trouvés sur **data.gouv.fr** pour *« ${searchQuery} »* :`;

  const items = datasets.slice(0, 3).map((ds, i) => {
    const org = ds.organization?.name ? ` · *${ds.organization.name}*` : '';
    const shortDesc =
      ds.description.length > 140
        ? `${ds.description.slice(0, 140).trim()}…`
        : ds.description;
    return `${i + 1}. **[${ds.title}](${ds.uri})**${org}\n   ${shortDesc}`;
  });

  return {
    answer: [intro, ...items].join('\n\n'),
    followUpSuggestions: [`${searchQuery} en CSV`, `Statistiques communales ${searchQuery}`],
  };
}
