import Anthropic from '@anthropic-ai/sdk';
import { MODEL, preferencesBlock, readBody, send, sendApiError } from './_shared.js';

// Documents rédigés à partir d'une séance déjà générée : explication du devis au patient, courrier à un confrère.
const CONSIGNES = {
  explication: `Tu aides un chirurgien-dentiste français à expliquer un devis à son patient.
Rédige un texte court (150 à 250 mots) en langage simple, vouvoiement, sans jargon (ou jargon expliqué entre parenthèses).
Explique : pourquoi ces soins sont proposés, ce que chaque acte va faire concrètement, le nombre de séances si la dictée le dit, le coût et le reste à charge avant mutuelle, et l'alternative 100 % Santé si elle figure dans le devis (sans reste à charge avec une complémentaire santé responsable).
Ton rassurant et neutre, sans pression commerciale. N'invente aucun fait clinique ni montant absent des données. Texte brut, pas de markdown.`,
  courrier: `Tu rédiges un courrier d'adressage d'un chirurgien-dentiste français à un confrère.
Format lettre en texte brut : formule d'appel (« Cher confrère, » ou « Chère consœur, » si le destinataire l'indique, sinon « Cher(e) confrère, »), objet de l'adressage, présentation du patient, éléments cliniques et radiologiques utiles, ce qui a déjà été fait, la demande précise au confrère, formule de politesse confraternelle, puis le nom du praticien.
Concis (200 à 300 mots), style médical. Numérotation dentaire FDI. N'invente aucun fait clinique absent des données. Pas de markdown.`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée' });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { error: 'no_api_key' });

  const body = readBody(req);
  const system = CONSIGNES[body.type];
  if (!system) return send(res, 400, { error: 'Type de document inconnu' });
  const contexte = JSON.stringify(body.contexte || {}).slice(0, 30000);

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: `Données de la séance (JSON) :\n${contexte}${preferencesBlock(body.preferences)}` }],
    });
    if (response.stop_reason === 'refusal') return send(res, 422, { error: "L'IA a refusé de rédiger ce document." });
    const texte = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!texte) return send(res, 502, { error: 'Réponse vide, réessayez.' });
    return send(res, 200, { texte });
  } catch (err) {
    return sendApiError(res, err);
  }
}
