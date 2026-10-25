import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { CCAM } from './_ccam.js';

const Result = z.object({
  compte_rendu: z.object({
    motif: z.string(),
    antecedents: z.string(),
    examen: z.string(),
    diagnostic: z.string(),
    actes_realises: z.string(),
    prescriptions: z.string(),
    suite: z.string(),
  }),
  actes: z.array(
    z.object({
      dent: z.string(),
      code: z.string(),
      libelle: z.string(),
      statut: z.enum(['realise', 'propose']),
    }),
  ),
  consignes_patient: z.string(),
  alertes: z.array(z.string()),
});

const referentiel = CCAM.map((a) => `${a.code} | ${a.libelle} | panier ${a.panier}`).join('\n');

const SYSTEM = `Tu es l'assistant de rédaction d'un chirurgien-dentiste français. Tu reçois la dictée brute d'une séance, souvent orale et désordonnée.

Produis :
- compte_rendu : un compte-rendu clinique clair et concis en français, au style d'un dossier dentaire. Numérotation dentaire FDI (11 à 48). Champ vide ("") si la dictée ne dit rien.
- actes : chaque acte réalisé pendant la séance (statut "realise") et chaque acte proposé pour un devis (statut "propose"), une ligne par dent. Utilise uniquement les codes du référentiel ci-dessous. Si aucun code ne convient, mets "HORS_REFERENTIEL" et décris l'acte dans libelle.
- consignes_patient : consignes post-séance à remettre au patient, en langage simple, vouvoiement, 3 à 6 points.
- alertes : ce que le praticien doit vérifier (information manquante, ambiguïté sur une dent, choix de matériau non précisé, allergie mentionnée...).

N'invente aucun fait clinique absent de la dictée. Tu ne poses pas de diagnostic à la place du praticien : tu reformules ce qu'il dit.

Référentiel CCAM (code | libellé | panier) :
${referentiel}`;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée' });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { error: 'no_api_key' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const dictee = String(body.dictee || '').trim();
  if (dictee.length < 10) return send(res, 400, { error: 'Dictée trop courte' });
  if (dictee.length > 20000) return send(res, 400, { error: 'Dictée trop longue' });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low', format: zodOutputFormat(Result) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Dictée de la séance :\n\n${dictee}` }],
    });
    if (response.stop_reason === 'refusal') return send(res, 422, { error: "L'IA a refusé de traiter cette dictée." });
    if (!response.parsed_output) return send(res, 502, { error: 'Réponse incomplète, réessayez.' });
    return send(res, 200, response.parsed_output);
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Trop de requêtes, réessayez dans un instant.' });
    if (err instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'Clé API invalide.' });
    return send(res, 500, { error: 'Erreur lors de la génération.' });
  }
}
