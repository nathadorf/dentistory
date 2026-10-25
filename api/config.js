// Réglages publics lus par le front. FEEDBACK_EMAIL remplace l'adresse de retour des testeurs.
// Ne renvoie jamais la clé elle-même, seulement si elle est configurée.
export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    feedbackEmail: process.env.FEEDBACK_EMAIL || 'nmajersdorf@gmail.com',
    ia: Boolean(process.env.ANTHROPIC_API_KEY), // false : le front prévient que la dictée ne sera pas analysée
    // Diagnostic quand la clé manque : environnement Vercel et noms (jamais les valeurs) des variables qui ressemblent à la clé.
    ...(!process.env.ANTHROPIC_API_KEY && {
      environnement: process.env.VERCEL_ENV || 'local',
      variables_proches: Object.keys(process.env).filter((k) => /anthropic/i.test(k)),
    }),
  }));
}
