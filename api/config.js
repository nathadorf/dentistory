// Réglages publics lus par le front. FEEDBACK_EMAIL remplace l'adresse de retour des testeurs.
export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ feedbackEmail: process.env.FEEDBACK_EMAIL || 'nmajersdorf@gmail.com' }));
}
