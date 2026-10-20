// netlify/functions/mcp.js
// Serveur MCP distant pour Upside Down Training (Streamable HTTP, stateless).
// Lecture seule sur Supabase via PostgREST + service_role key.
//
// ENV REQUIS (Netlify > Site settings > Environment variables) :
//   SUPABASE_URL          ex: https://tltqtpbaaxiwwpvuzszt.supabase.co
//   SUPABASE_SERVICE_KEY  service_role key
//   MCP_SECRET            jeton secret de ton choix (long, aleatoire)
//
// URL du connecteur :
//   https://upside-down-training.netlify.app/.netlify/functions/mcp?key=LE_MCP_SECRET

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MCP_SECRET = process.env.MCP_SECRET;

const SERVER_NAME = 'upside-down-training';
const SERVER_VERSION = '1.0.0';
const DEFAULT_PROTOCOL = '2025-06-18';

/* ---------------------------------------------------------------- Supabase */

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status} sur ${path} : ${body.slice(0, 300)}`);
  }
  return res.json();
}

const enc = encodeURIComponent;

// Construit un index id -> ligne (pour les jointures faites en JS).
function indexById(rows, key = 'id') {
  const map = new Map();
  for (const r of rows) map.set(r[key], r);
  return map;
}

// Recupere les lignes dont l'id est dans la liste (par paquets de 100).
async function fetchByIds(table, ids, select) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return [];
  const out = [];
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    out.push(...(await sb(`${table}?id=in.(${chunk.join(',')})&select=${enc(select)}`)));
  }
  return out;
}

async function resolveStudioId(slugOrName) {
  if (!slugOrName) return null;
  const rows = await sb(
    `studios?or=(slug.eq.${enc(slugOrName)},name.ilike.${enc('%' + slugOrName + '%')})&select=id,slug,name&limit=1`
  );
  if (!rows.length) throw new Error(`Studio introuvable : ${slugOrName}`);
  return rows[0].id;
}

function daysAgoISO(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------- Tools */

const TOOLS = [
  {
    name: 'list_studios',
    description:
      'Liste les studios (clubs partenaires) de la plateforme Upside Down Training, avec leur nombre d athletes, leur formule et leur statut.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search_athletes',
    description:
      'Recherche des athletes/coachs par nom ou email. Filtre optionnel par studio (slug ou nom). Renvoie id, nom, email, role et studio.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nom ou email, recherche partielle. Vide = tous.' },
        studio: { type: 'string', description: 'Slug ou nom du studio. Omettre pour tous les studios.' },
        limit: { type: 'number', description: 'Max de resultats (defaut 50).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'athlete_profile',
    description:
      'Fiche complete d un athlete : profil, acces programmes en cours, records (PR) par mouvement et 15 derniers scores de WOD.',
    inputSchema: {
      type: 'object',
      properties: { athlete_id: { type: 'string', description: 'UUID de l athlete (via search_athletes).' } },
      required: ['athlete_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_sessions',
    description:
      'Liste les seances programmees sur une periode, avec leur programme. Utile pour relire la programmation d une semaine.',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Date de debut AAAA-MM-JJ (defaut : il y a 7 jours).' },
        date_to: { type: 'string', description: 'Date de fin AAAA-MM-JJ (defaut : aujourd hui + 7 jours).' },
        programme: { type: 'string', description: 'Slug ou nom du programme (filtre optionnel).' },
        studio: { type: 'string', description: 'Slug ou nom du studio (filtre optionnel).' },
        limit: { type: 'number', description: 'Max de seances (defaut 60).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'session_leaderboard',
    description: 'Tous les scores enregistres sur une seance donnee, avec le nom des athletes, le niveau et le RX.',
    inputSchema: {
      type: 'object',
      properties: { session_id: { type: 'string', description: 'UUID de la seance (via list_sessions).' } },
      required: ['session_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'recent_activity',
    description:
      'Activite recente : nombre de scores postes par athlete sur les N derniers jours et date du dernier score. Permet de reperer qui decroche.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Fenetre en jours (defaut 7).' },
        studio: { type: 'string', description: 'Slug ou nom du studio (filtre optionnel).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'wellness_summary',
    description:
      'Suivi wellness d un athlete sur les N derniers jours (fatigue, courbatures, sommeil, energie, motivation, humeur, stress) avec moyennes.',
    inputSchema: {
      type: 'object',
      properties: {
        athlete_id: { type: 'string', description: 'UUID de l athlete.' },
        days: { type: 'number', description: 'Fenetre en jours (defaut 30).' },
      },
      required: ['athlete_id'],
      additionalProperties: false,
    },
  },
];

const HANDLERS = {
  async list_studios() {
    const studios = await sb(
      'studios?select=id,name,slug,is_active,plan_tier,athlete_count,contact_email,instagram,website&order=name.asc'
    );
    return { count: studios.length, studios };
  },

  async search_athletes({ query, studio, limit }) {
    const parts = ['select=id,full_name,email,role,is_coach,gender,studio_id,created_at'];
    if (query) {
      const q = enc('%' + query + '%');
      parts.push(`or=(full_name.ilike.${q},email.ilike.${q})`);
    }
    if (studio) {
      const sid = await resolveStudioId(studio);
      parts.push(`studio_id=eq.${sid}`);
    }
    parts.push(`limit=${Math.min(Number(limit) || 50, 200)}`, 'order=full_name.asc');

    const athletes = await sb(`profiles?${parts.join('&')}`);
    const studios = indexById(await fetchByIds('studios', athletes.map((a) => a.studio_id), 'id,name,slug'));
    return {
      count: athletes.length,
      athletes: athletes.map((a) => ({
        ...a,
        studio: a.studio_id ? studios.get(a.studio_id)?.name || null : 'Upside Down',
      })),
    };
  },

  async athlete_profile({ athlete_id }) {
    const [profile] = await sb(
      `profiles?id=eq.${enc(athlete_id)}&select=id,full_name,email,role,is_coach,gender,studio_id,created_at&limit=1`
    );
    if (!profile) throw new Error(`Athlete introuvable : ${athlete_id}`);

    const [prs, access, scores] = await Promise.all([
      sb(`athlete_prs?athlete_id=eq.${enc(athlete_id)}&select=movement_id,value,format,recorded_at,is_coach_estimate&order=recorded_at.desc`),
      sb(`programme_access?athlete_id=eq.${enc(athlete_id)}&select=programme_id,granted_at,expires_at,start_date`),
      sb(`wod_scores?athlete_id=eq.${enc(athlete_id)}&select=id,session_id,score_type,score_value,score_text,rx,level,notes,done_at,created_at&order=created_at.desc&limit=15`),
    ]);

    const movements = indexById(await fetchByIds('movements', prs.map((p) => p.movement_id), 'id,name,unit,category'));
    const programmes = indexById(await fetchByIds('programmes', access.map((a) => a.programme_id), 'id,name,slug,type'));
    const sessions = indexById(await fetchByIds('sessions', scores.map((s) => s.session_id), 'id,title,type,date,programme_id'));

    const now = Date.now();
    return {
      profile: { ...profile, studio: profile.studio_id ? (await fetchByIds('studios', [profile.studio_id], 'id,name,slug'))[0]?.name : 'Upside Down' },
      programme_access: access.map((a) => ({
        programme: programmes.get(a.programme_id)?.name || a.programme_id,
        start_date: a.start_date,
        expires_at: a.expires_at,
        actif: !a.expires_at || new Date(a.expires_at).getTime() > now,
      })),
      prs: prs.map((p) => ({
        mouvement: movements.get(p.movement_id)?.name || p.movement_id,
        categorie: movements.get(p.movement_id)?.category || null,
        valeur: p.value,
        unite: movements.get(p.movement_id)?.unit || null,
        format: p.format,
        date: p.recorded_at,
        estimation_coach: p.is_coach_estimate,
      })),
      derniers_scores: scores.map((s) => ({
        seance: sessions.get(s.session_id)?.title || null,
        type: sessions.get(s.session_id)?.type || s.score_type,
        date: s.done_at || (s.created_at || '').slice(0, 10),
        score: s.score_text ?? s.score_value,
        rx: s.rx,
        niveau: s.level,
        notes: s.notes,
      })),
    };
  },

  async list_sessions({ date_from, date_to, programme, studio, limit }) {
    const from = date_from || daysAgoISO(7);
    const to = date_to || daysAgoISO(-7);
    const parts = [
      'select=id,title,type,date,intensity,score_type,is_benchmark,week_number,day_of_week,programme_id,studio_id,target',
      `date=gte.${from}`,
      `date=lte.${to}`,
      'order=date.asc,sort_order.asc',
      `limit=${Math.min(Number(limit) || 60, 300)}`,
    ];
    if (programme) {
      const rows = await sb(
        `programmes?or=(slug.eq.${enc(programme)},name.ilike.${enc('%' + programme + '%')})&select=id&limit=1`
      );
      if (!rows.length) throw new Error(`Programme introuvable : ${programme}`);
      parts.push(`programme_id=eq.${rows[0].id}`);
    }
    if (studio) parts.push(`studio_id=eq.${await resolveStudioId(studio)}`);

    const sessions = await sb(`sessions?${parts.join('&')}`);
    const programmes = indexById(await fetchByIds('programmes', sessions.map((s) => s.programme_id), 'id,name,slug'));
    return {
      periode: { du: from, au: to },
      count: sessions.length,
      sessions: sessions.map((s) => ({ ...s, programme: programmes.get(s.programme_id)?.name || null })),
    };
  },

  async session_leaderboard({ session_id }) {
    const [session] = await sb(
      `sessions?id=eq.${enc(session_id)}&select=id,title,type,date,score_type,content&limit=1`
    );
    if (!session) throw new Error(`Seance introuvable : ${session_id}`);

    const scores = await sb(
      `wod_scores?session_id=eq.${enc(session_id)}&select=athlete_id,score_type,score_value,score_text,rx,level,notes,done_at&order=score_value.desc`
    );
    const athletes = indexById(await fetchByIds('profiles', scores.map((s) => s.athlete_id), 'id,full_name'));
    return {
      seance: session,
      count: scores.length,
      scores: scores.map((s) => ({
        athlete: athletes.get(s.athlete_id)?.full_name || s.athlete_id,
        score: s.score_text ?? s.score_value,
        rx: s.rx,
        niveau: s.level,
        date: s.done_at,
        notes: s.notes,
      })),
    };
  },

  async recent_activity({ days, studio }) {
    const window = Number(days) || 7;
    const since = daysAgoISO(window);
    const parts = [`select=athlete_id,created_at,done_at`, `created_at=gte.${since}`, 'limit=5000'];
    if (studio) parts.push(`studio_id=eq.${await resolveStudioId(studio)}`);

    const scores = await sb(`wod_scores?${parts.join('&')}`);
    const byAthlete = new Map();
    for (const s of scores) {
      const cur = byAthlete.get(s.athlete_id) || { scores: 0, dernier: null };
      cur.scores += 1;
      const d = s.done_at || (s.created_at || '').slice(0, 10);
      if (!cur.dernier || d > cur.dernier) cur.dernier = d;
      byAthlete.set(s.athlete_id, cur);
    }
    const athletes = indexById(await fetchByIds('profiles', [...byAthlete.keys()], 'id,full_name,studio_id'));
    const rows = [...byAthlete.entries()]
      .map(([id, v]) => ({ athlete: athletes.get(id)?.full_name || id, athlete_id: id, ...v }))
      .sort((a, b) => b.scores - a.scores);

    return { fenetre_jours: window, depuis: since, athletes_actifs: rows.length, total_scores: scores.length, detail: rows };
  },

  async wellness_summary({ athlete_id, days }) {
    const window = Number(days) || 30;
    const since = daysAgoISO(window);
    const entries = await sb(
      `wellness_entries?athlete_id=eq.${enc(athlete_id)}&date=gte.${since}&select=date,fatigue,soreness,sleep_quality,energy,motivation,mood,stress,notes,scale_max&order=date.desc`
    );
    const champs = ['fatigue', 'soreness', 'sleep_quality', 'energy', 'motivation', 'mood', 'stress'];
    const moyennes = {};
    for (const c of champs) {
      const vals = entries.map((e) => e[c]).filter((v) => typeof v === 'number');
      moyennes[c] = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
    }
    return { fenetre_jours: window, depuis: since, saisies: entries.length, moyennes, entrees: entries };
  },
};

/* -------------------------------------------------------------- JSON-RPC */

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const ko = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function handleRpc(msg) {
  const { id, method, params } = msg || {};
  if (id === undefined || id === null) return null; // notification : pas de reponse

  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: (params && params.protocolVersion) || DEFAULT_PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        });

      case 'ping':
        return ok(id, {});

      case 'tools/list':
        return ok(id, { tools: TOOLS });

      case 'resources/list':
        return ok(id, { resources: [] });

      case 'prompts/list':
        return ok(id, { prompts: [] });

      case 'tools/call': {
        const name = params && params.name;
        const fn = HANDLERS[name];
        if (!fn) return ko(id, -32602, `Outil inconnu : ${name}`);
        try {
          const data = await fn((params && params.arguments) || {});
          return ok(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
        } catch (e) {
          return ok(id, { content: [{ type: 'text', text: `Erreur : ${e.message}` }], isError: true });
        }
      }

      default:
        return ko(id, -32601, `Methode non supportee : ${method}`);
    }
  } catch (e) {
    return ko(id, -32603, e.message);
  }
}

/* --------------------------------------------------------------- Handler */

exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!SUPABASE_URL || !SERVICE_KEY || !MCP_SECRET) {
    return json(500, { error: 'Variables d environnement manquantes (SUPABASE_URL, SUPABASE_SERVICE_KEY, MCP_SECRET).' });
  }

  const key = (event.queryStringParameters && event.queryStringParameters.key) || '';
  if (key !== MCP_SECRET) return json(401, { error: 'Non autorise' });

  if (event.httpMethod === 'DELETE') return { statusCode: 200, body: '' };
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Seul POST est supporte (Streamable HTTP sans flux SSE).' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } });
  }

  if (Array.isArray(payload)) {
    const results = (await Promise.all(payload.map(handleRpc))).filter(Boolean);
    return results.length ? json(200, results) : { statusCode: 202, body: '' };
  }

  const result = await handleRpc(payload);
  return result ? json(200, result) : { statusCode: 202, body: '' };
};
