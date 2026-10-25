// Référentiel CCAM dentaire réduit pour la V0.
// Sources : listes CCAM v34 et actes prothétiques plafonnés publiées par Eugenol.
// base = base de remboursement Sécurité sociale (€), plafond = honoraire limite de facturation (€),
// panier = "soins" (tarif opposable), "100%" (100 % Santé), "modere" (reste à charge maîtrisé) ou "libre".
// Montants indicatifs, à remettre à jour sur ameli.fr avant tout usage réel.
export const CCAM = [
  // Soins conservateurs
  { code: 'HBJD001', libelle: 'Détartrage et polissage des dents', categorie: 'Soins', base: 28.92, plafond: null, panier: 'soins' },
  { code: 'HBMD058', libelle: 'Restauration 1 face, secteur incisivo-canin, matériau inséré en phase plastique', categorie: 'Soins', base: 19.28, plafond: null, panier: 'soins' },
  { code: 'HBMD050', libelle: 'Restauration 2 faces, secteur incisivo-canin, matériau inséré en phase plastique', categorie: 'Soins', base: 33.74, plafond: null, panier: 'soins' },
  { code: 'HBMD054', libelle: 'Restauration 3 faces ou plus, secteur incisivo-canin, matériau inséré en phase plastique', categorie: 'Soins', base: 40.97, plafond: null, panier: 'soins' },
  { code: 'HBMD053', libelle: 'Restauration 1 face, secteur prémolo-molaire, matériau inséré en phase plastique', categorie: 'Soins', base: 19.28, plafond: null, panier: 'soins' },
  { code: 'HBMD049', libelle: 'Restauration 2 faces, secteur prémolo-molaire, matériau inséré en phase plastique', categorie: 'Soins', base: 33.74, plafond: null, panier: 'soins' },
  { code: 'HBMD038', libelle: 'Restauration 3 faces ou plus, secteur prémolo-molaire, matériau inséré en phase plastique', categorie: 'Soins', base: 40.97, plafond: null, panier: 'soins' },
  { code: 'HBBD005', libelle: 'Scellement prophylactique des sillons, 1 dent', categorie: 'Soins', base: 21.69, plafond: null, panier: 'soins' },
  // Endodontie
  { code: 'HBFD001', libelle: 'Exérèse du contenu canalaire non vivant, incisive ou canine permanente', categorie: 'Endodontie', base: 33.74, plafond: null, panier: 'soins' },
  { code: 'HBFD003', libelle: 'Exérèse du contenu canalaire non vivant, prémolaire (hors 1re prémolaire maxillaire)', categorie: 'Endodontie', base: 48.20, plafond: null, panier: 'soins' },
  { code: 'HBFD024', libelle: 'Exérèse du contenu canalaire non vivant, molaire permanente', categorie: 'Endodontie', base: 81.94, plafond: null, panier: 'soins' },
  // Chirurgie
  { code: 'HBGD036', libelle: "Avulsion d'une dent permanente sur arcade, sans alvéolectomie", categorie: 'Chirurgie', base: 33.44, plafond: null, panier: 'soins' },
  // Radiologie
  { code: 'HBQK389', libelle: 'Radiographie rétro-alvéolaire, secteur de 1 à 3 dents contiguës', categorie: 'Radiologie', base: 7.98, plafond: null, panier: 'soins' },
  { code: 'HBQK002', libelle: 'Radiographie panoramique dentomaxillaire', categorie: 'Radiologie', base: 21.28, plafond: null, panier: 'soins' },
  // Prothèse fixe
  { code: 'HBLD038', libelle: 'Couronne dentoportée métallique', categorie: 'Prothèse', base: 120, plafond: 290, panier: '100%' },
  { code: 'HBLD634', libelle: 'Couronne dentoportée céramométallique, incisive, canine ou 1re prémolaire', categorie: 'Prothèse', base: 120, plafond: 500, panier: '100%' },
  { code: 'HBLD491', libelle: 'Couronne dentoportée céramométallique, 2e prémolaire', categorie: 'Prothèse', base: 120, plafond: 550, panier: 'modere' },
  { code: 'HBLD734', libelle: 'Couronne dentoportée céramométallique, molaire', categorie: 'Prothèse', base: 107.5, plafond: null, panier: 'libre' },
  { code: 'HBLD350', libelle: 'Couronne dentoportée céramique monolithique zircone, hors molaire', categorie: 'Prothèse', base: 120, plafond: 440, panier: '100%' },
  { code: 'HBLD073', libelle: 'Couronne dentoportée céramique monolithique zircone, molaire', categorie: 'Prothèse', base: 120, plafond: 440, panier: 'modere' },
  { code: 'HBLD680', libelle: 'Couronne dentoportée céramique monolithique hors zircone, incisive, canine ou 1re prémolaire', categorie: 'Prothèse', base: 120, plafond: 500, panier: '100%' },
  { code: 'HBLD158', libelle: 'Couronne dentoportée céramique monolithique hors zircone, 2e prémolaire ou molaire', categorie: 'Prothèse', base: 120, plafond: 550, panier: 'modere' },
  { code: 'HBLD403', libelle: 'Couronne dentoportée céramocéramique', categorie: 'Prothèse', base: 107.5, plafond: null, panier: 'libre' },
  { code: 'HBLD090', libelle: 'Infrastructure coronoradiculaire (inlay-core), dent antérieure ou 1re prémolaire', categorie: 'Prothèse', base: 90, plafond: 175, panier: '100%' },
  { code: 'HBLD745', libelle: 'Infrastructure coronoradiculaire (inlay-core), 2e prémolaire ou molaire', categorie: 'Prothèse', base: 90, plafond: 175, panier: '100%' },
  { code: 'HBLD033', libelle: 'Bridge 2 piliers et intermédiaire métalliques', categorie: 'Prothèse', base: 279.5, plafond: 870, panier: '100%' },
  { code: 'HBLD785', libelle: "Bridge 2 piliers et intermédiaire céramométalliques, remplacement d'une incisive", categorie: 'Prothèse', base: 279.5, plafond: 1465, panier: '100%' },
  { code: 'HBLD227', libelle: "Bridge 2 piliers et intermédiaire céramométalliques, dent autre qu'une incisive", categorie: 'Prothèse', base: 279.5, plafond: 1635, panier: 'modere' },
  // Prothèse amovible
  { code: 'HBLD031', libelle: 'Prothèse complète définitive unimaxillaire à plaque résine', categorie: 'Prothèse amovible', base: 182.75, plafond: 1100, panier: '100%' },
  { code: 'HBLD035', libelle: 'Prothèse complète définitive bimaxillaire à plaque résine', categorie: 'Prothèse amovible', base: 365.5, plafond: 2300, panier: '100%' },
];

export const CCAM_BY_CODE = Object.fromEntries(CCAM.map((a) => [a.code, a]));
