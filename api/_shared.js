import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-opus-5-5';

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function readBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

// Préférences de rédaction saisies par le praticien dans « Mon cabinet ».
export function preferencesBlock(preferences) {
  const p = String(preferences || '').trim().slice(0, 2000);
  return p ? `\n\nPréférences de rédaction du praticien, à respecter :\n${p}` : '';
}

export function sendApiError(res, err) {
  console.error(err);
  if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Trop de requêtes, réessayez dans un instant.' });
  if (err instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'Clé API invalide.' });
  return send(res, 500, { error: 'Erreur lors de la génération.' });
}
