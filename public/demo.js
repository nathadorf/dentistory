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
};
