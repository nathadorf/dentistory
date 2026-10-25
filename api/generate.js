import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { CCAM } from './_ccam.js';
import { MODEL, preferencesBlock, readBody, send, sendApiError } from './_shared.js';

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

La dictée vient souvent d'une reconnaissance vocale qui fait des erreurs :
- « deux dents » est souvent « des dents » : interprète selon le contexte.
- Les numéros de dents peuvent être mal entendus (vingt-six / trente-six, seize / six...). Un numéro qui n'existe pas en FDI (19, 29, 30, 50...) ou qui contredit la localisation dite (« en haut à gauche » mais 36, « molaire » mais 12) ne doit pas être corrigé en silence : garde-le et ajoute une alerte qui cite le numéro et la contradiction.

Si une séance précédente est fournie, c'est le contexte du même patient : sers-t'en pour compléter les antécédents et relier la suite du traitement, mais ne recopie pas comme réalisés des actes qui ne sont pas dans la dictée du jour.

N'invente aucun fait clinique absent de la dictée. Tu ne poses pas de diagnostic à la place du praticien : tu reformules ce qu'il dit.

Référentiel CCAM (code | libellé | panier) :
${referentiel}`;

// Résumé de la séance précédente du même patient, envoyé par le front pour une séance de suivi.
function precedentBlock(precedent) {
  if (!precedent || typeof precedent !== 'object') return '';
  return `Séance précédente du même patient (contexte, JSON) :\n${JSON.stringify(precedent).slice(0, 8000)}\n\n`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée' });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { error: 'no_api_key' });

  const body = readBody(req);
  const dictee = String(body.dictee || '').trim();
  if (dictee.length < 10) return send(res, 400, { error: 'Dictée trop courte' });
  if (dictee.length > 20000) return send(res, 400, { error: 'Dictée trop longue' });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low', format: zodOutputFormat(Result) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `${precedentBlock(body.precedent)}Dictée de la séance :\n\n${dictee}${preferencesBlock(body.preferences)}` }],
    });
    if (response.stop_reason === 'refusal') return send(res, 422, { error: "L'IA a refusé de traiter cette dictée." });
    if (!response.parsed_output) return send(res, 502, { error: 'Réponse incomplète, réessayez.' });
    return send(res, 200, response.parsed_output);
  } catch (err) {
    return sendApiError(res, err);
  }
}
