// Cas fictif utilisé par « Charger un exemple » et par le mode démo sans clé API.
window.DEMO = {
  dictee: "Patient de 52 ans, vient pour une douleur sur la 36 depuis une semaine, surtout au chaud. Pas d'antécédent particulier, pas d'allergie connue, il prend juste un traitement pour la tension. À l'examen la 36 a une grosse carie distale, test au froid négatif, percussion positive. Radio rétro-alvéolaire : lésion péri-apicale sur la racine mésiale. Diagnostic nécrose pulpaire de la 36. Aujourd'hui j'ai fait la radio et commencé le traitement endodontique de la 36, pansement provisoire. Par ailleurs la 46 a une ancienne couronne fracturée, à refaire. Je lui propose sur la 36 après le traitement un inlay-core et une couronne zircone, et sur la 46 une couronne céramo-métallique, en lui expliquant l'alternative en zircone. Prochain rendez-vous dans 10 jours pour finir l'endo. Prescription paracétamol 1 g trois fois par jour si douleur.",
  result: {
    compte_rendu: {
      motif: "Douleur sur 36 depuis une semaine, majorée au chaud.",
      antecedents: "Hypertension artérielle traitée. Pas d'allergie connue.",
      examen: "36 : carie distale volumineuse, test au froid négatif, percussion positive. Radiographie rétro-alvéolaire : lésion péri-apicale sur la racine mésiale. 46 : couronne ancienne fracturée.",
      diagnostic: "Nécrose pulpaire de la 36 avec lésion péri-apicale.",
      actes_realises: "Radiographie rétro-alvéolaire. Début du traitement endodontique de la 36, obturation provisoire.",
      prescriptions: "Paracétamol 1 g, 3 fois par jour si douleur.",
      suite: "Rendez-vous dans 10 jours pour terminer le traitement endodontique de la 36. Puis inlay-core et couronne zircone sur 36, couronne céramométallique sur 46 (alternative zircone présentée).",
    },
    actes: [
      { dent: "36", code: "HBQK389", libelle: "Radiographie rétro-alvéolaire", statut: "realise" },
      { dent: "36", code: "HBFD024", libelle: "Traitement endodontique molaire (débuté)", statut: "realise" },
      { dent: "36", code: "HBLD745", libelle: "Inlay-core molaire", statut: "propose" },
      { dent: "36", code: "HBLD073", libelle: "Couronne zircone molaire", statut: "propose" },
      { dent: "46", code: "HBLD734", libelle: "Couronne céramométallique molaire", statut: "propose" },
    ],
    consignes_patient: "- Évitez de mâcher du côté gauche jusqu'au prochain rendez-vous : la dent est fermée par un pansement provisoire.\n- Si le pansement tombe, appelez le cabinet.\n- En cas de douleur : paracétamol 1 g, jusqu'à 3 fois par jour.\n- Une gêne légère pendant 2 à 3 jours est normale. Si la joue gonfle ou si vous avez de la fièvre, contactez-nous rapidement.\n- Prochain rendez-vous dans 10 jours pour terminer le traitement.",
    alertes: [
      "Endodontie de la 36 débutée et non terminée : vérifier la cotation à la séance de fin de traitement."
    ],
  },
  documents: {
    explication: "Lors de votre visite, nous avons trouvé deux dents à traiter.\n\nLa dent 36 (en bas à gauche) est infectée. Nous avons commencé à la soigner en nettoyant l'intérieur de ses racines (traitement endodontique) ; ce soin se termine au prochain rendez-vous. Une fois soignée, cette dent est fragile : nous vous proposons de la renforcer avec un ancrage dans la racine (inlay-core), puis de la protéger avec une couronne en zircone, une céramique solide et de couleur naturelle.\n\nLa dent 46 (en bas à droite) porte une ancienne couronne cassée qu'il faut remplacer. Nous vous proposons une couronne céramo-métallique.\n\nLe devis détaille le prix de chaque soin, la part remboursée par l'Assurance Maladie et ce qui reste à votre charge avant votre complémentaire santé.\n\nIl existe aussi une solution 100 % Santé : des couronnes métalliques sur ces deux molaires. Avec une complémentaire santé responsable, elle n'entraîne aucun reste à charge. Elle est tout aussi solide, mais de couleur métal.\n\nVous pouvez prendre le temps de réfléchir et nous poser toutes vos questions avant de signer.",
    courrier: "Cher(e) confrère,\n\nJe vous adresse M. D., 52 ans, pour avis et prise en charge.\n\nAntécédents : hypertension artérielle traitée, pas d'allergie connue.\n\nLe patient a consulté pour une douleur sur la 36 depuis une semaine, majorée au chaud. À l'examen, la 36 présente une carie distale volumineuse, un test au froid négatif et une percussion positive. La radiographie rétro-alvéolaire montre une lésion péri-apicale sur la racine mésiale, en faveur d'une nécrose pulpaire.\n\nJ'ai débuté le traitement endodontique de la 36 et mis en place une obturation provisoire. Une prescription de paracétamol a été faite.\n\nJe vous remercie de bien vouloir le recevoir pour la suite de la prise en charge de la 36 et de me tenir informé de votre avis.\n\nJe vous prie de croire, cher(e) confrère, à l'assurance de mes sentiments confraternels.\n\nDr ...",
    consentement: "NATURE DES SOINS PROPOSÉS\n- Dent 36 : reconstitution par ancrage dans la racine (inlay-core), puis couronne en céramique zircone.\n- Dent 46 : remplacement de la couronne fracturée par une couronne céramo-métallique.\n\nBÉNÉFICES ATTENDUS\nRetrouver une mastication confortable, protéger les dents fragilisées et éviter leur fracture.\n\nRISQUES ET EFFETS INDÉSIRABLES POSSIBLES\nSensibilité passagère, gêne gingivale de quelques jours, descellement ou fracture de la couronne, fracture de la racine, nécessité de reprendre le traitement de racine. Ces complications sont rares.\n\nALTERNATIVES\n- Couronnes métalliques (panier 100 % Santé), sans reste à charge avec une complémentaire santé responsable.\n- Abstention : risque de fracture de la 36 pouvant conduire à son extraction, et persistance d'une couronne cassée sur la 46.\n\nCOÛT\nLe détail figure sur le devis qui vous a été remis.\n\nCONSENTEMENT\nJe soussigné(e) ............................................ déclare avoir reçu une information claire et compréhensible sur les soins proposés, leurs bénéfices, leurs risques et les alternatives possibles. J'ai pu poser toutes mes questions et j'ai disposé d'un délai de réflexion suffisant. J'accepte les soins décrits ci-dessus.",
  },
};
