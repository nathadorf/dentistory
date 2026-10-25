# Dentistory

Assistant IA pour chirurgiens-dentistes : le praticien dicte sa séance, l'app rédige le compte-rendu, propose les actes CCAM, prépare un devis et les consignes à remettre au patient. Elle s'utilise à côté du logiciel de cabinet existant (copier-coller et PDF), sans le remplacer.

> V0 de démonstration : utiliser uniquement des cas fictifs ou anonymisés. Aucune donnée n'est stockée côté serveur, mais la dictée est envoyée à l'API Claude, qui n'est pas un hébergement certifié HDS.

## Ce que fait la V0

1. **Dictée** au micro dans le navigateur (Chrome, Edge, Safari) ou texte tapé/collé.
2. **Compte-rendu** structuré (motif, antécédents, examen, diagnostic, actes réalisés, prescriptions, suite), éditable et copiable.
3. **Actes CCAM** proposés depuis un référentiel réduit (`api/_ccam.js`), avec dent, panier (soins, 100 % Santé, tarif maîtrisé, libre) et honoraires modifiables. Les honoraires saisis sont mémorisés comme grille tarifaire du praticien.
4. **Devis** simplifié imprimable en PDF : honoraires, base de remboursement, remboursement AMO estimé, reste à charge. Quand un acte proposé n'est pas dans le panier 100 % Santé, le devis ajoute automatiquement une **alternative 100 % Santé** (couronne céramométallique, zircone ou métallique selon la dent, bridge métallique).
5. **Devis expliqué au patient** : texte en langage simple, à copier ou imprimer.
6. **Consignes patient** en langage simple, imprimables.
7. **Courrier d'adressage** à un confrère (chirurgien oral, parodontiste, orthodontiste...) rédigé depuis la séance.
8. **Alertes** sur ce qu'il faut vérifier (code hors référentiel, honoraires libres non saisis, honoraires au-dessus du plafond, informations manquantes).
9. **Historique** des 30 dernières séances, gardé dans le navigateur, pour rouvrir et reprendre une séance.

« Mon cabinet » règle les infos du praticien (nom, adresse, RPPS, n° AM) et ses **préférences de rédaction**, transmises à l'IA à chaque génération. Tout reste dans le navigateur.

Si la variable `FEEDBACK_EMAIL` est définie, un bouton « Donner mon avis » ouvre un e-mail pré-rempli pour les testeurs.

## Lancer en local

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start   # http://localhost:3000
```

Sans `ANTHROPIC_API_KEY`, l'app fonctionne en **mode démo** : « Générer » affiche un exemple pré-enregistré (bouton « Charger un exemple »).

## Déployer sur Vercel

1. Importer le repo dans Vercel (aucun framework, `vercel.json` sert `public/` et les fonctions de `api/`).
2. Ajouter la variable d'environnement `ANTHROPIC_API_KEY` (et, en option, `FEEDBACK_EMAIL`).
3. Déployer.

## Structure

| Fichier | Rôle |
|---|---|
| `public/index.html`, `app.js`, `style.css` | Interface, sans build |
| `public/demo.js` | Cas fictif et résultat du mode démo |
| `api/generate.js` | Appel à Claude (sortie structurée validée par zod) |
| `api/document.js` | Explication du devis et courrier d'adressage |
| `api/config.js` | Réglages publics (e-mail de retour des testeurs) |
| `api/ccam.js`, `api/_ccam.js` | Référentiel CCAM servi au front |
| `server.js` | Serveur local équivalent à Vercel |

## Limites connues (à traiter avant un usage réel)

- **Tarifs CCAM indicatifs** : bases de remboursement et plafonds repris de listes publiques 2019-2023, certaines bases (HBLD734, HBLD403, bridges, prothèses amovibles) sont à vérifier. Mettre à jour depuis ameli.fr.
- **Devis simplifié** : il ne reprend pas le modèle conventionnel officiel complet ; il sert à préparer le devis à saisir dans le logiciel du cabinet.
- **Conformité** : avant tout vrai patient, hébergement HDS (y compris le fournisseur d'IA), AIPD RGPD et contrat de sous-traitance avec chaque cabinet.
- La dictée vocale dépend du navigateur (Web Speech API) et n'est pas disponible sur Firefox.
