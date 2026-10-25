(() => {
  const $ = (sel) => document.querySelector(sel);
  const PANIERS = { soins: 'Soins', '100%': '100 % Santé', modere: 'Tarif maîtrisé', libre: 'Tarif libre' };
  const CR_FIELDS = [
    ['motif', 'Motif de consultation'],
    ['antecedents', 'Antécédents'],
    ['examen', 'Examen clinique et radiologique'],
    ['diagnostic', 'Diagnostic'],
    ['actes_realises', 'Actes réalisés'],
    ['prescriptions', 'Prescriptions'],
    ['suite', 'Suite du traitement'],
  ];
  // Couronnes hors 100 % Santé, pour lesquelles le devis doit présenter une alternative sans reste à charge.
  const COURONNES_HORS_100 = ['HBLD491', 'HBLD734', 'HBLD073', 'HBLD158', 'HBLD403'];
  const HISTORY_KEY = 'dentistory.historique';
  const HISTORY_MAX = 30;
  const DEVIS_STATUTS = { a_remettre: 'À remettre', remis: 'Remis au patient', accepte: 'Accepté', refuse: 'Refusé' };
  // Schéma dentaire FDI, vu de face : arcade du haut 18 → 28, arcade du bas 48 → 38.
  const ARCADES = [
    [[18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28]],
    [[48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]],
  ];

  const MODELES_KEY = 'dentistory.modeles';
  // Trames de dictée courantes : le praticien complète les « ___ » au lieu de tout redire.
  const MODELES_DEFAUT = [
    ['Détartrage', "Détartrage et polissage des deux arcades. Hygiène ___. Conseils de brossage donnés. Prochain contrôle dans 6 mois."],
    ['Composite', "Carie sur la ___ face ___. Anesthésie para-apicale. Curetage, restauration composite ___ face(s). Réglage de l'occlusion."],
    ['Extraction', "Extraction de la ___ sous anesthésie locale, sans alvéolectomie. Hémostase par compression. Consignes post-opératoires données. Prescription : ___."],
    ['Urgence douleur', "Patient vu en urgence pour douleur sur la ___ depuis ___. Test au froid ___, percussion ___. Radio rétro-alvéolaire : ___. Diagnostic : ___. Traitement réalisé : ___."],
    ['Contrôle', "Consultation de contrôle. Pas de doléance. Examen clinique : ___. Radiographies : ___. Soins à prévoir : ___."],
  ];

  let ccam = [];
  let ccamByCode = {};
  let state = null; // { compte_rendu, actes: [{dent, code, libelle, statut, honoraires}], consignes_patient, alertes, explication, courrier }
  let currentId = null;
  let demoMode = false;
  let suiteDe = null; // séance précédente du même patient, envoyée comme contexte à la génération

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const eur = (n) => (Number.isFinite(n) ? n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '—');
  const today = () => new Date().toLocaleDateString('fr-FR');

  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ } },
  };

  function setStatus(text, isError = false) {
    const el = $('#status');
    el.textContent = text;
    el.classList.toggle('error', isError);
  }

  function praticien() { return storage.get('dentistory.praticien', {}); }

  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (r.status === 503 && data.error === 'no_api_key') return { demo: true };
    if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
    return { data };
  }

  function setDemo(on) {
    demoMode = on;
    $('#demo-banner').hidden = !on;
  }

  // ---------- Dictée vocale (Web Speech API) ----------
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let recording = false;

  function setupMic() {
    const btn = $('#btn-mic');
    if (!Recognition) {
      btn.disabled = true;
      $('#mic-hint').textContent = 'La dictée vocale nécessite Chrome, Edge ou Safari. Vous pouvez taper ou coller le texte.';
      return;
    }
    recognition = new Recognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    const area = $('#dictee');
    let base = '';
    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) base += (base && !base.endsWith(' ') ? ' ' : '') + text.trim();
        else interim += text;
      }
      area.value = base + (interim ? ' ' + interim : '');
    };
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') $('#mic-hint').textContent = "Accès au micro refusé. Autorisez-le dans le navigateur.";
    };
    // Chrome coupe après un silence : on relance tant que l'utilisateur n'a pas arrêté.
    recognition.onend = () => { if (recording) recognition.start(); };

    btn.addEventListener('click', () => {
      recording = !recording;
      btn.setAttribute('aria-pressed', String(recording));
      $('#mic-label').textContent = recording ? 'Arrêter la dictée' : 'Démarrer la dictée';
      if (recording) {
        base = area.value.trim();
        recognition.start();
        $('#mic-hint').textContent = 'Parlez naturellement, la transcription apparaît en direct.';
      } else {
        recognition.stop();
        $('#mic-hint').textContent = '';
      }
    });
  }

  // ---------- Génération ----------
  async function generate() {
    const dictee = $('#dictee').value.trim();
    if (dictee.length < 10) return setStatus('Dictez ou tapez quelques phrases avant de générer.', true);
    if (recording) $('#btn-mic').click();

    const btn = $('#btn-generate');
    btn.disabled = true;
    setStatus('Rédaction en cours, quelques secondes...');
    try {
      const { demo, data } = await post('/api/generate', { dictee, preferences: praticien().preferences, precedent: precedent() });
      setDemo(Boolean(demo));
      currentId = Date.now().toString(36);
      load(demo ? window.DEMO.result : data);
      saveSession();
      setSuite(null);
      setStatus(demo ? 'Exemple pré-enregistré affiché (mode démo).' : 'Terminé. Relisez et corrigez avant usage.');
    } catch (err) {
      setStatus(err.message || 'Erreur réseau.', true);
    } finally {
      btn.disabled = false;
    }
  }

  function defaultHonoraires(code) {
    const a = ccamByCode[code];
    if (!a) return 0;
    const tarif = storage.get('dentistory.tarifs', {})[code];
    if (tarif != null) return a.plafond != null ? Math.min(tarif, a.plafond) : tarif;
    return a.plafond ?? (a.panier === 'libre' ? 0 : a.base);
  }

  function load(result) {
    state = {
      compte_rendu: { ...result.compte_rendu },
      consignes_patient: result.consignes_patient || '',
      alertes: [...(result.alertes || [])],
      actes: (result.actes || []).map((a) => ({ ...a, honoraires: a.honoraires ?? defaultHonoraires(a.code) })),
      explication: result.explication || '',
      courrier: result.courrier || '',
      ordonnance: result.ordonnance ?? result.compte_rendu?.prescriptions ?? '',
      consentement: result.consentement || '',
      devisStatut: result.devisStatut || 'a_remettre',
    };
    display();
  }

  function display() {
    $('#empty').hidden = true;
    $('#output').hidden = false;
    renderAlertes();
    renderCR();
    renderActes();
    renderDevis();
    $('#consignes').value = state.consignes_patient;
    $('#explication').value = state.explication;
    $('#explain-box').hidden = !state.explication;
    $('#courrier').value = state.courrier;
    $('#courrier').hidden = $('#courrier-actions').hidden = !state.courrier;
    $('#ordonnance').value = state.ordonnance ?? state.compte_rendu.prescriptions ?? '';
    $('#consentement').value = state.consentement || '';
    $('#consentement').hidden = $('#consentement-actions').hidden = !state.consentement;
    $('#devis-statut').value = state.devisStatut || 'a_remettre';
    showTab('cr');
  }

  // ---------- Documents complémentaires (explication du devis, courrier) ----------
  function contexteSeance(extra = {}) {
    const p = praticien();
    return {
      patient: $('#patient-nom').value.trim() || null,
      praticien: { nom: p.nom || null, adresse: p.adresse || null, tel: p.tel || null },
      compte_rendu: state.compte_rendu,
      devis: devisLignes().map((a) => ({ dent: a.dent, code: a.code, acte: ccamByCode[a.code]?.libelle || a.libelle, panier: PANIERS[ccamByCode[a.code]?.panier] || null, ...montants(a) })),
      alternative_100_sante: alternativeLignes()?.map((a) => ({ dent: a.dent, code: a.code, acte: ccamByCode[a.code]?.libelle, ...montants(a) })) || null,
      ...extra,
    };
  }

  async function writeDocument(type, extra, btn, onText) {
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Rédaction...';
    try {
      const { demo, data } = await post('/api/document', { type, contexte: contexteSeance(extra), preferences: praticien().preferences });
      if (demo) setDemo(true);
      onText(demo ? window.DEMO.documents[type] : data.texte);
      saveSession();
    } catch (err) {
      setStatus(err.message || 'Erreur réseau.', true);
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  // ---------- Devis ----------
  function montants(a) {
    const ref = ccamByCode[a.code];
    const base = ref?.base ?? 0;
    const taux = ref && ref.categorie.startsWith('Prothèse') ? 0.6 : 0.7;
    const honoraires = Number(a.honoraires) || 0;
    const amo = Math.min(base, honoraires) * taux;
    return { honoraires, base, amo, reste: honoraires - amo };
  }

  function alternative100(acte) {
    const ref = ccamByCode[acte.code];
    if (!ref || ref.panier === '100%' || ref.panier === 'soins') return null;
    let code = null;
    if (COURONNES_HORS_100.includes(acte.code)) {
      // Position FDI : 1-2 incisives, 3 canine, 4 1re prémolaire, 5 2e prémolaire, 6-8 molaires.
      const pos = Number(String(acte.dent).trim().slice(-1));
      code = pos >= 1 && pos <= 4 ? 'HBLD634' : pos === 5 ? 'HBLD350' : 'HBLD038';
    } else if (acte.code === 'HBLD227') {
      code = 'HBLD033';
    }
    return code ? { dent: acte.dent, code, libelle: ccamByCode[code].libelle, statut: 'propose', honoraires: defaultHonoraires(code) } : null;
  }

  const devisLignes = () => state.actes.filter((a) => a.statut === 'propose');

  // Plan de traitement équivalent où chaque acte hors 100 % Santé est remplacé ; null si rien à remplacer.
  function alternativeLignes() {
    const lignes = devisLignes();
    const alt = lignes.map((a) => alternative100(a) || a);
    return alt.some((a, i) => a !== lignes[i]) ? alt : null;
  }

  function tableDevis(lignes) {
    const tot = { honoraires: 0, base: 0, amo: 0 };
    const rows = lignes.map((a) => {
      const ref = ccamByCode[a.code];
      const m = montants(a);
      tot.honoraires += m.honoraires; tot.base += m.base; tot.amo += m.amo;
      return `<tr>
        <td>${esc(a.dent)}</td><td>${esc(a.code)}</td><td>${esc(ref?.libelle || a.libelle)}</td>
        <td>${ref ? PANIERS[ref.panier] : '—'}</td>
        <td class="num">${eur(m.honoraires)}</td><td class="num">${eur(m.base)}</td><td class="num">${eur(m.amo)}</td>
      </tr>`;
    }).join('');
    return { tot, html: `<table>
      <thead><tr><th>Dent</th><th>Code CCAM</th><th>Acte et matériau</th><th>Panier</th><th class="num">Honoraires</th><th class="num">Base de remb.</th><th class="num">Remb. AMO estimé</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="num">${eur(tot.honoraires)}</td><td class="num">${eur(tot.base)}</td><td class="num">${eur(tot.amo)}</td></tr></tfoot>
    </table>` };
  }

  function devisHTML() {
    const p = praticien();
    const lignes = devisLignes();
    const nom = $('#patient-nom').value.trim() || '—';
    const ddn = $('#patient-ddn').value ? new Date($('#patient-ddn').value).toLocaleDateString('fr-FR') : '—';
    let corps = '<p>Aucun acte proposé. Passez un acte en « Proposé (devis) » dans l\'onglet Actes CCAM.</p>';
    if (lignes.length) {
      const principal = tableDevis(lignes);
      corps = `<h2>Traitement proposé</h2>${principal.html}
        <p><strong>Reste à charge avant complémentaire santé :</strong> ${eur(principal.tot.honoraires - principal.tot.amo)}</p>`;
      const alt = alternativeLignes();
      if (alt) {
        const t = tableDevis(alt);
        corps += `<h2>Alternative 100 % Santé</h2>
          <p class="small">Les actes hors panier 100 % Santé sont remplacés par leur équivalent sans reste à charge pour un patient couvert par une complémentaire santé responsable.</p>
          ${t.html}
          <p><strong>Reste à charge avant complémentaire santé :</strong> ${eur(t.tot.honoraires - t.tot.amo)}, pris en charge par la complémentaire santé responsable pour les actes 100 % Santé.</p>`;
      }
    }
    return `<div class="doc">
      <div class="doc-head">
        <div><strong>${esc(p.nom || 'Nom du praticien')}</strong><br>${esc(p.adresse || 'Adresse du cabinet')}<br>
          ${p.tel ? 'Tél. ' + esc(p.tel) + '<br>' : ''}RPPS : ${esc(p.rpps || '—')} · N° AM : ${esc(p.am || '—')}</div>
        <div><strong>Patient :</strong> ${esc(nom)}<br><strong>Né(e) le :</strong> ${esc(ddn)}<br><strong>Date du devis :</strong> ${today()}</div>
      </div>
      <h1>Devis pour traitement et acte bucco-dentaire</h1>
      <p class="small">Modèle simplifié généré par Dentistory V0, à reporter sur le devis conventionnel de votre logiciel.</p>
      ${corps}
      <p class="small">Remboursement Assurance Maladie estimé à 70 % (soins) ou 60 % (prothèses) de la base, hors cas particuliers (ALD, C2S...). Montants indicatifs. Devis valable 6 mois.</p>
      <div class="sign"><div>Date et signature du praticien</div><div>Date et signature du patient, précédées de « Lu et accepté »</div></div>
    </div>`;
  }

  // ---------- Rendu ----------
  function renderAlertes() {
    const hors = state.actes.filter((a) => !ccamByCode[a.code]).map((a) => `Acte « ${a.libelle} » (dent ${a.dent}) hors référentiel : choisissez un code.`);
    const libres = devisLignes().filter((a) => ccamByCode[a.code]?.panier === 'libre' && !a.honoraires)
      .map((a) => `Dent ${a.dent} : ${ccamByCode[a.code].libelle} en tarif libre, saisissez vos honoraires.`);
    const plafonds = state.actes.filter((a) => ccamByCode[a.code]?.plafond != null && a.honoraires > ccamByCode[a.code].plafond)
      .map((a) => `Dent ${a.dent} : honoraires au-dessus du plafond de ${eur(ccamByCode[a.code].plafond)} pour ${a.code}.`);
    const all = [...state.alertes, ...hors, ...libres, ...plafonds];
    $('#alertes').innerHTML = all.length ? `<strong>À vérifier</strong><ul>${all.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  }

  function renderCR() {
    $('#cr-fields').innerHTML = CR_FIELDS.map(([key, label]) => `
      <div class="cr-field">
        <label for="cr-${key}">${label}</label>
        <textarea id="cr-${key}" data-key="${key}" rows="${Math.max(2, Math.ceil((state.compte_rendu[key] || '').length / 70))}">${esc(state.compte_rendu[key])}</textarea>
      </div>`).join('');
  }

  function codeOptions(selected) {
    const groups = {};
    for (const a of ccam) (groups[a.categorie] ||= []).push(a);
    const unknown = selected && !ccamByCode[selected] ? `<option value="${esc(selected)}" selected>À choisir (${esc(selected)})</option>` : '';
    return unknown + Object.entries(groups).map(([cat, list]) => `<optgroup label="${esc(cat)}">${list.map((a) =>
      `<option value="${a.code}" ${a.code === selected ? 'selected' : ''}>${a.code} · ${esc(a.libelle)}</option>`).join('')}</optgroup>`).join('');
  }

  function renderActes() {
    $('#actes-body').innerHTML = state.actes.map((a, i) => {
      const ref = ccamByCode[a.code];
      const panier = ref ? `<span class="pill p${ref.panier.replace('%', '')}">${PANIERS[ref.panier]}</span>` : '';
      return `<tr data-i="${i}">
        <td><select data-f="statut"><option value="realise" ${a.statut === 'realise' ? 'selected' : ''}>Réalisé</option><option value="propose" ${a.statut === 'propose' ? 'selected' : ''}>Proposé (devis)</option></select></td>
        <td class="dent"><input data-f="dent" value="${esc(a.dent)}" inputmode="numeric"></td>
        <td><select class="code" data-f="code">${codeOptions(a.code)}</select><div class="libelle">${esc(a.libelle)}</div></td>
        <td>${panier}</td>
        <td class="prix"><input data-f="honoraires" type="number" min="0" step="0.01" value="${a.honoraires}"></td>
        <td><button class="del" type="button" title="Supprimer" data-del="${i}">✕</button></td>
      </tr>`;
    }).join('');
    renderOdonto();
  }

  function renderOdonto() {
    const statut = {};
    for (const a of state.actes) {
      const d = String(a.dent).trim();
      if (a.statut === 'propose') statut[d] = 'p';
      else if (!statut[d]) statut[d] = 'r';
    }
    const dent = (n) => `<button type="button" data-dent="${n}" class="${statut[n] || ''}" title="Dent ${n}">${n}</button>`;
    $('#odonto').innerHTML = ARCADES.map(([g, d], i) =>
      `<div class="arcade ${i ? 'lower' : 'upper'}">${g.map(dent).join('')}<span class="mid"></span>${d.map(dent).join('')}</div>`).join('');
  }

  function ajouterActe(dent) {
    // Restauration 1 face par défaut, secteur selon la dent ; le praticien choisit ensuite le bon code.
    const pos = Number(String(dent).slice(-1));
    const code = pos >= 1 && pos <= 3 ? 'HBMD058' : 'HBMD053';
    state.actes.push({ dent: String(dent), code, libelle: ccamByCode[code]?.libelle || '', statut: 'propose', honoraires: defaultHonoraires(code) });
    renderActes();
    renderAlertes();
    saveSession();
    const rows = $('#actes-body').querySelectorAll('tr');
    rows[rows.length - 1]?.querySelector('select.code')?.focus();
  }

  function renderDevis() { $('#devis-preview').innerHTML = devisHTML(); }

  function headerDoc() {
    const p = praticien();
    return `<div class="doc-head"><div><strong>${esc(p.nom || 'Votre dentiste')}</strong><br>${esc(p.adresse || '')}${p.tel ? '<br>Tél. ' + esc(p.tel) : ''}</div><div>${today()}</div></div>`;
  }

  const texteHTML = (titre, texte) => `<div class="doc">${headerDoc()}${titre ? `<h1>${esc(titre)}</h1>` : ''}<div class="text-doc">${esc(texte)}</div></div>`;

  function ordonnanceHTML() {
    const p = praticien();
    const nom = $('#patient-nom').value.trim() || '—';
    return `<div class="doc">
      <div class="doc-head">
        <div><strong>${esc(p.nom || 'Nom du praticien')}</strong><br>Chirurgien-dentiste<br>${esc(p.adresse || '')}${p.tel ? '<br>Tél. ' + esc(p.tel) : ''}<br>RPPS : ${esc(p.rpps || '—')} · N° AM : ${esc(p.am || '—')}</div>
        <div>Le ${today()}<br><strong>Patient :</strong> ${esc(nom)}</div>
      </div>
      <h1>Ordonnance</h1>
      <div class="text-doc">${esc($('#ordonnance').value)}</div>
      <div class="sign"><div></div><div>Signature du praticien</div></div>
    </div>`;
  }

  function consentementHTML() {
    const nom = $('#patient-nom').value.trim();
    return `<div class="doc">${headerDoc()}<h1>Consentement éclairé aux soins dentaires</h1>
      ${nom ? `<p><strong>Patient :</strong> ${esc(nom)}</p>` : ''}
      <div class="text-doc">${esc($('#consentement').value)}</div>
      <div class="sign"><div>Signature du praticien</div><div>Date et signature du patient, précédées de « Lu et approuvé »</div></div></div>`;
  }

  // ---------- Suivi des devis ----------
  function totalDevis(st) {
    return (st?.actes || []).filter((a) => a.statut === 'propose').reduce((t, a) => t + (Number(a.honoraires) || 0), 0);
  }

  function renderSuivi() {
    const list = storage.get(HISTORY_KEY, []).filter((e) => totalDevis(e.state) > 0);
    const somme = (statut) => list.filter((e) => (e.state.devisStatut || 'a_remettre') === statut).reduce((t, e) => t + totalDevis(e.state), 0);
    const nb = (statut) => list.filter((e) => (e.state.devisStatut || 'a_remettre') === statut).length;
    const decides = nb('accepte') + nb('refuse');
    $('#suivi-kpis').innerHTML = [
      [String(list.length), 'devis'],
      [eur(somme('remis') + somme('a_remettre')), 'en attente de réponse'],
      [eur(somme('accepte')), 'acceptés'],
      [decides ? Math.round((nb('accepte') / decides) * 100) + ' %' : '—', "taux d'acceptation"],
    ].map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
    $('#suivi-table').innerHTML = list.length ? `<thead><tr><th>Date</th><th>Patient</th><th class="num">Montant</th><th>Statut</th><th></th></tr></thead><tbody>${list.map((e) => {
      const st = e.state.devisStatut || 'a_remettre';
      const enAttente = st === 'remis' || st === 'a_remettre';
      return `<tr data-id="${e.id}">
        <td>${new Date(e.date).toLocaleDateString('fr-FR')}</td>
        <td>${esc(e.patient || 'Patient sans nom')}${e.demo ? ' · démo' : ''}<div class="libelle">${esc(e.state.compte_rendu?.motif || '')}</div></td>
        <td class="num">${eur(totalDevis(e.state))}</td>
        <td><select data-statut>${Object.entries(DEVIS_STATUTS).map(([k, l]) => `<option value="${k}" ${k === st ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td>${enAttente ? `<button class="ghost" type="button" data-relance>Relancer</button>${e.relance ? `<div class="libelle">Relancé le ${new Date(e.relance).toLocaleDateString('fr-FR')}</div>` : ''}` : ''}</td>
      </tr>`;
    }).join('')}</tbody>` : '<tbody><tr><td class="hint">Aucun devis pour l\'instant. Les devis générés apparaissent ici.</td></tr></tbody>';
  }

  function updateEntry(id, fn) {
    const list = storage.get(HISTORY_KEY, []);
    const e = list.find((x) => x.id === id);
    if (!e) return null;
    fn(e);
    storage.set(HISTORY_KEY, list);
    return e;
  }

  function messageRelance(e) {
    const p = praticien();
    const date = new Date(e.date).toLocaleDateString('fr-FR');
    return `Bonjour${e.patient ? ' ' + e.patient : ''},\n\nSuite à votre rendez-vous du ${date}, nous vous avons remis un devis pour votre plan de traitement (${eur(totalDevis(e.state))}). Avez-vous pu en prendre connaissance ? Nous restons à votre disposition pour répondre à vos questions ou planifier les soins.\n\nBien cordialement,\n${p.nom || 'Le cabinet'}${p.tel ? '\n' + p.tel : ''}`;
  }

  function printDoc(html) {
    $('#print-area').innerHTML = html;
    window.print();
  }

  function crText() {
    const nom = $('#patient-nom').value.trim();
    const head = `Compte-rendu du ${today()}${nom ? ' · ' + nom : ''}`;
    const body = CR_FIELDS.map(([k, l]) => (state.compte_rendu[k] ? `${l} : ${state.compte_rendu[k]}` : null)).filter(Boolean).join('\n');
    const actes = state.actes.filter((a) => a.statut === 'realise').map((a) => `- ${a.dent} : ${a.code} ${ccamByCode[a.code]?.libelle || a.libelle}`).join('\n');
    return `${head}\n\n${body}${actes ? '\n\nActes cotés :\n' + actes : ''}`;
  }

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = 'Copié';
      setTimeout(() => { btn.textContent = old; }, 1500);
    } catch {
      setStatus('Copie impossible, sélectionnez le texte manuellement.', true);
    }
  }

  function showTab(name) {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.dataset.panel !== name; });
    if (name === 'devis') renderDevis();
  }

  // ---------- Historique (navigateur uniquement) ----------
  function saveSession() {
    if (!state || !currentId) return;
    const all = storage.get(HISTORY_KEY, []);
    const prev = all.find((e) => e.id === currentId) || {};
    const list = all.filter((e) => e.id !== currentId);
    list.unshift({
      ...prev, // garde les champs gérés ailleurs (date de relance)
      id: currentId,
      date: prev.date || new Date().toISOString(),
      patient: $('#patient-nom').value.trim(),
      ddn: $('#patient-ddn').value,
      dictee: $('#dictee').value,
      demo: demoMode,
      state,
    });
    storage.set(HISTORY_KEY, list.slice(0, HISTORY_MAX));
  }

  function renderHistory() {
    const list = storage.get(HISTORY_KEY, []);
    $('#history-list').innerHTML = list.length ? list.map((e) => `
      <li>
        <div><strong>${esc(e.patient || 'Patient sans nom')}</strong> · ${new Date(e.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}${e.demo ? ' · démo' : ''}
          <div class="hint">${esc(e.state?.compte_rendu?.motif || '')}</div></div>
        <div class="li-actions"><button class="ghost" type="button" data-open="${e.id}">Ouvrir</button><button class="ghost" type="button" data-suite="${e.id}" title="Nouvelle séance pour ce patient, avec le contexte de celle-ci">Nouvelle séance</button><button class="del" type="button" title="Supprimer" data-remove="${e.id}">✕</button></div>
      </li>`).join('') : '<li class="hint">Aucune séance pour l\'instant.</li>';
  }

  function openSession(id) {
    const e = storage.get(HISTORY_KEY, []).find((x) => x.id === id);
    if (!e) return;
    currentId = e.id;
    $('#patient-nom').value = e.patient || '';
    $('#patient-ddn').value = e.ddn || '';
    $('#dictee').value = e.dictee || '';
    setDemo(Boolean(e.demo));
    state = e.state;
    display();
    setStatus('Séance rouverte depuis l\'historique.');
  }

  // ---------- Séance de suivi ----------
  function precedent() {
    if (!suiteDe?.state) return null;
    const st = suiteDe.state;
    return {
      date: new Date(suiteDe.date).toLocaleDateString('fr-FR'),
      compte_rendu: st.compte_rendu,
      actes: (st.actes || []).map((a) => ({ dent: a.dent, code: a.code, libelle: ccamByCode[a.code]?.libelle || a.libelle, statut: a.statut })),
    };
  }

  function setSuite(entry) {
    suiteDe = entry;
    $('#suite-banner').hidden = !entry;
    if (entry) $('#suite-text').textContent = `Suite de la séance du ${new Date(entry.date).toLocaleDateString('fr-FR')} : le compte-rendu reprendra son contexte.`;
  }

  function nouvelleSeance(id) {
    const e = storage.get(HISTORY_KEY, []).find((x) => x.id === id);
    if (!e) return;
    $('#patient-nom').value = e.patient || '';
    $('#patient-ddn').value = e.ddn || '';
    $('#dictee').value = '';
    setSuite(e);
    $('#dictee').focus();
    setStatus('Nouvelle séance pour ce patient : dictez ce qui a été fait aujourd\'hui.');
  }

  // ---------- Modèles de séance ----------
  function modeles() {
    return [
      ...MODELES_DEFAUT.map(([nom, texte]) => ({ nom, texte })),
      ...storage.get(MODELES_KEY, []).map((m) => ({ ...m, perso: true })),
    ];
  }

  function renderModeles() {
    $('#modeles').innerHTML = modeles().map((m, i) => `<span class="chip${m.perso ? ' perso' : ''}"><button type="button" data-modele="${i}" title="${esc(m.texte)}">${esc(m.nom)}</button>${m.perso ? `<button type="button" class="x" data-del-modele="${esc(m.nom)}" title="Supprimer ce modèle">✕</button>` : ''}</span>`).join('');
  }

  function insererModele(texte) {
    const ta = $('#dictee');
    ta.value = ta.value.trim() ? `${ta.value.trimEnd()}\n${texte}` : texte;
    ta.focus();
    // place le curseur sur le premier trou à compléter
    const trou = ta.value.indexOf('___', ta.value.length - texte.length);
    if (trou >= 0) ta.setSelectionRange(trou, trou + 3);
  }

  // ---------- Dossier patient et envoi ----------
  function dossierHTML() {
    const pages = [];
    if (devisLignes().length) pages.push(devisHTML());
    if ($('#explication').value.trim()) pages.push(texteHTML('Votre plan de traitement expliqué', $('#explication').value));
    if ($('#consentement').value.trim()) pages.push(consentementHTML());
    if ($('#consignes').value.trim()) pages.push(texteHTML('Vos consignes après la séance', $('#consignes').value));
    if ($('#ordonnance').value.trim()) pages.push(ordonnanceHTML());
    return pages.map((html, i) => `<div${i ? ' class="page-break"' : ''}>${html}</div>`).join('');
  }

  function signature() {
    const p = praticien();
    return `\n\n${p.nom || 'Le cabinet'}${p.tel ? '\n' + p.tel : ''}`;
  }

  // ---------- Événements ----------
  function bind() {
    $('#btn-generate').addEventListener('click', generate);
    $('#btn-example').addEventListener('click', () => {
      $('#dictee').value = window.DEMO.dictee;
      if (!$('#patient-nom').value) $('#patient-nom').value = 'M. D. (fictif)';
    });
    $('#btn-clear').addEventListener('click', () => { $('#dictee').value = ''; setStatus(''); setSuite(null); });
    $('#btn-suite-off').addEventListener('click', () => setSuite(null));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#btn-generate').disabled && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        generate();
      }
    });

    $('#modeles').addEventListener('click', (e) => {
      if (e.target.dataset.modele != null) insererModele(modeles()[Number(e.target.dataset.modele)].texte);
      if (e.target.dataset.delModele != null) {
        storage.set(MODELES_KEY, storage.get(MODELES_KEY, []).filter((m) => m.nom !== e.target.dataset.delModele));
        renderModeles();
      }
    });
    $('#btn-save-modele').addEventListener('click', () => {
      const texte = $('#dictee').value.trim();
      if (texte.length < 10) return setStatus('Tapez ou dictez d\'abord le texte du modèle (vous pouvez laisser des « ___ » à compléter).', true);
      const nom = (window.prompt('Nom du modèle (ex. : Endo molaire)') || '').trim();
      if (!nom) return;
      const perso = storage.get(MODELES_KEY, []).filter((m) => m.nom !== nom);
      perso.push({ nom, texte });
      storage.set(MODELES_KEY, perso);
      renderModeles();
      setStatus(`Modèle « ${nom} » enregistré.`);
    });

    $('#btn-pack').addEventListener('click', () => {
      const html = dossierHTML();
      if (!html) return setStatus('Rien à imprimer pour l\'instant.', true);
      printDoc(html);
    });
    $('#output').addEventListener('click', (e) => {
      const b = e.target.closest('[data-email], [data-sms]');
      if (!b) return;
      const texte = $(b.dataset.email || b.dataset.sms).value.trim();
      if (!texte) return setStatus('Le texte est vide.', true);
      const body = encodeURIComponent(texte + signature());
      window.location.href = b.dataset.email
        ? `mailto:?subject=${encodeURIComponent(b.dataset.subject || '')}&body=${body}`
        : `sms:?&body=${body}`;
    });
    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

    $('#cr-fields').addEventListener('input', (e) => { if (e.target.dataset.key) { state.compte_rendu[e.target.dataset.key] = e.target.value; saveSession(); } });
    $('#consignes').addEventListener('input', (e) => { state.consignes_patient = e.target.value; saveSession(); });
    $('#explication').addEventListener('input', (e) => { state.explication = e.target.value; saveSession(); });
    $('#courrier').addEventListener('input', (e) => { state.courrier = e.target.value; saveSession(); });
    $('#ordonnance').addEventListener('input', (e) => { state.ordonnance = e.target.value; saveSession(); });
    $('#consentement').addEventListener('input', (e) => { state.consentement = e.target.value; saveSession(); });
    $('#devis-statut').addEventListener('change', (e) => { state.devisStatut = e.target.value; saveSession(); });
    $('#odonto').addEventListener('click', (e) => { if (e.target.dataset.dent) ajouterActe(e.target.dataset.dent); });

    $('#btn-print-ordonnance').addEventListener('click', () => printDoc(ordonnanceHTML()));
    $('#btn-consent').addEventListener('click', (e) => {
      if (!devisLignes().length) return setStatus('Aucun acte proposé : le consentement porte sur les actes du devis.', true);
      writeDocument('consentement', {}, e.target, (texte) => {
        state.consentement = texte;
        $('#consentement').value = texte;
        $('#consentement').hidden = $('#consentement-actions').hidden = false;
      });
    });
    $('#btn-copy-consentement').addEventListener('click', (e) => copy($('#consentement').value, e.target));
    $('#btn-print-consentement').addEventListener('click', () => printDoc(consentementHTML()));

    const suivi = $('#suivi');
    $('#btn-suivi').addEventListener('click', () => { renderSuivi(); suivi.showModal(); });
    $('#btn-suivi-close').addEventListener('click', () => suivi.close());
    $('#suivi-table').addEventListener('change', (e) => {
      const id = e.target.closest('tr')?.dataset.id;
      if (!id || e.target.dataset.statut == null) return;
      updateEntry(id, (x) => { x.state.devisStatut = e.target.value; });
      if (id === currentId && state) { state.devisStatut = e.target.value; $('#devis-statut').value = e.target.value; }
      renderSuivi();
    });
    $('#suivi-table').addEventListener('click', (e) => {
      const id = e.target.closest('tr')?.dataset.id;
      if (!id || e.target.dataset.relance == null) return;
      const entry = updateEntry(id, (x) => { x.relance = new Date().toISOString(); });
      if (entry) copy(messageRelance(entry), e.target).then(() => setTimeout(renderSuivi, 1600));
    });

    $('#actes-body').addEventListener('change', (e) => {
      const tr = e.target.closest('tr');
      const f = e.target.dataset.f;
      if (!tr || !f) return;
      const acte = state.actes[Number(tr.dataset.i)];
      if (f === 'honoraires') {
        acte.honoraires = Number(e.target.value) || 0;
        const tarifs = storage.get('dentistory.tarifs', {});
        tarifs[acte.code] = acte.honoraires; // mémorise la grille tarifaire du praticien
        storage.set('dentistory.tarifs', tarifs);
      } else {
        acte[f] = e.target.value;
        if (f === 'code') { acte.libelle = ccamByCode[acte.code]?.libelle || acte.libelle; acte.honoraires = defaultHonoraires(acte.code); }
      }
      renderActes();
      renderAlertes();
      saveSession();
    });
    $('#actes-body').addEventListener('click', (e) => {
      if (e.target.dataset.del == null) return;
      state.actes.splice(Number(e.target.dataset.del), 1);
      renderActes();
      renderAlertes();
      saveSession();
    });
    $('#btn-add-acte').addEventListener('click', () => {
      const code = ccam[0].code;
      state.actes.push({ dent: '', code, libelle: ccamByCode[code].libelle, statut: 'propose', honoraires: defaultHonoraires(code) });
      renderActes();
      saveSession();
    });

    $('#btn-copy-cr').addEventListener('click', (e) => copy(crText(), e.target));
    $('#btn-copy-consignes').addEventListener('click', (e) => copy($('#consignes').value, e.target));
    $('#btn-print-devis').addEventListener('click', () => printDoc(devisHTML()));
    $('#btn-print-consignes').addEventListener('click', () => printDoc(texteHTML('Vos consignes après la séance', $('#consignes').value)));

    $('#btn-explain').addEventListener('click', (e) => {
      if (!devisLignes().length) return setStatus('Aucun acte proposé à expliquer.', true);
      writeDocument('explication', {}, e.target, (texte) => {
        state.explication = texte;
        $('#explication').value = texte;
        $('#explain-box').hidden = false;
      });
    });
    $('#btn-copy-explication').addEventListener('click', (e) => copy($('#explication').value, e.target));
    $('#btn-print-explication').addEventListener('click', () => printDoc(texteHTML('Votre plan de traitement expliqué', $('#explication').value)));

    $('#btn-letter').addEventListener('click', (e) => {
      const destinataire = { specialite: $('#courrier-spe').value, nom: $('#courrier-nom').value.trim() || null };
      writeDocument('courrier', { destinataire, demande: $('#courrier-demande').value.trim() || null }, e.target, (texte) => {
        state.courrier = texte;
        $('#courrier').value = texte;
        $('#courrier').hidden = $('#courrier-actions').hidden = false;
      });
    });
    $('#btn-copy-courrier').addEventListener('click', (e) => copy($('#courrier').value, e.target));
    $('#btn-print-courrier').addEventListener('click', () => printDoc(texteHTML('', $('#courrier').value)));

    const settings = $('#settings');
    const settingsFields = () => settings.querySelectorAll('input, textarea');
    $('#btn-settings').addEventListener('click', () => {
      const p = praticien();
      for (const el of settingsFields()) el.value = p[el.name] || '';
      settings.showModal();
    });
    settings.addEventListener('close', () => {
      if (settings.returnValue !== 'save') return;
      const p = {};
      for (const el of settingsFields()) p[el.name] = el.value.trim();
      storage.set('dentistory.praticien', p);
      if (state) renderDevis();
    });

    const history = $('#history');
    $('#btn-history').addEventListener('click', () => { renderHistory(); history.showModal(); });
    $('#btn-history-close').addEventListener('click', () => history.close());
    $('#history-list').addEventListener('click', (e) => {
      if (e.target.dataset.open) { openSession(e.target.dataset.open); setSuite(null); history.close(); }
      if (e.target.dataset.suite) { nouvelleSeance(e.target.dataset.suite); history.close(); }
      if (e.target.dataset.remove) {
        storage.set(HISTORY_KEY, storage.get(HISTORY_KEY, []).filter((x) => x.id !== e.target.dataset.remove));
        renderHistory();
      }
    });
  }

  async function setupFeedback() {
    try {
      const { feedbackEmail } = await (await fetch('/api/config')).json();
      if (!feedbackEmail) return;
      const body = "Ce qui m'a fait gagner du temps :\n\n\nCe qui est faux ou manque :\n\n\nCe que je voudrais en plus :\n\n\nCombien je paierais par mois :\n";
      const a = $('#btn-feedback');
      a.href = `mailto:${feedbackEmail}?subject=${encodeURIComponent('Avis sur Dentistory V0')}&body=${encodeURIComponent(body)}`;
      a.hidden = false;
    } catch { /* bouton laissé masqué */ }
  }

  async function init() {
    bind();
    renderModeles();
    setupMic();
    setupFeedback();
    try {
      ccam = await (await fetch('/api/ccam')).json();
      ccamByCode = Object.fromEntries(ccam.map((a) => [a.code, a]));
    } catch {
      setStatus('Référentiel CCAM indisponible.', true);
    }
  }

  init();
})();
