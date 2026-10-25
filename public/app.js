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

  let ccam = [];
  let ccamByCode = {};
  let state = null; // { compte_rendu, actes: [{dent, code, libelle, statut, honoraires}], consignes_patient, alertes }

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
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dictee }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 503 && data.error === 'no_api_key') {
        $('#demo-banner').hidden = false;
        load(window.DEMO.result);
        setStatus('Exemple pré-enregistré affiché (mode démo).');
        return;
      }
      if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
      $('#demo-banner').hidden = true;
      load(data);
      setStatus('Terminé. Relisez et corrigez avant usage.');
    } catch (err) {
      setStatus(err.message || 'Erreur réseau.', true);
    } finally {
      btn.disabled = false;
    }
  }

  function defaultHonoraires(code) {
    const a = ccamByCode[code];
    if (!a) return 0;
    const tarifs = storage.get('dentistory.tarifs', {});
    if (tarifs[code] != null) return tarifs[code];
    return a.plafond ?? (a.panier === 'libre' ? 0 : a.base);
  }

  function load(result) {
    state = {
      compte_rendu: { ...result.compte_rendu },
      consignes_patient: result.consignes_patient || '',
      alertes: [...(result.alertes || [])],
      actes: (result.actes || []).map((a) => ({ ...a, honoraires: defaultHonoraires(a.code) })),
    };
    $('#empty').hidden = true;
    $('#output').hidden = false;
    renderAlertes();
    renderCR();
    renderActes();
    renderDevis();
    $('#consignes').value = state.consignes_patient;
    showTab('cr');
  }

  // ---------- Rendu ----------
  function renderAlertes() {
    const hors = state.actes.filter((a) => !ccamByCode[a.code]).map((a) => `Acte « ${a.libelle} » (dent ${a.dent}) hors référentiel : choisissez un code.`);
    const libres = state.actes.filter((a) => a.statut === 'propose' && ccamByCode[a.code]?.panier === 'libre' && !a.honoraires)
      .map((a) => `Dent ${a.dent} : ${ccamByCode[a.code].libelle} en tarif libre, saisissez vos honoraires.`);
    const all = [...state.alertes, ...hors, ...libres];
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
  }

  function praticien() { return storage.get('dentistory.praticien', {}); }

  function devisHTML() {
    const p = praticien();
    const lignes = state.actes.filter((a) => a.statut === 'propose');
    let totHono = 0, totBase = 0, totAmo = 0;
    const rows = lignes.map((a) => {
      const ref = ccamByCode[a.code];
      const base = ref?.base ?? 0;
      const taux = ref && ref.categorie.startsWith('Prothèse') ? 0.6 : 0.7;
      const amo = Math.min(base, a.honoraires) * taux;
      totHono += Number(a.honoraires) || 0; totBase += base; totAmo += amo;
      return `<tr>
        <td>${esc(a.dent)}</td><td>${esc(a.code)}</td><td>${esc(ref?.libelle || a.libelle)}</td>
        <td>${ref ? PANIERS[ref.panier] : '—'}</td>
        <td class="num">${eur(Number(a.honoraires))}</td><td class="num">${eur(base)}</td><td class="num">${eur(amo)}</td>
      </tr>`;
    }).join('');
    const nom = $('#patient-nom').value.trim() || '—';
    const ddn = $('#patient-ddn').value ? new Date($('#patient-ddn').value).toLocaleDateString('fr-FR') : '—';
    const alternatives = lignes.some((a) => ['modere', 'libre'].includes(ccamByCode[a.code]?.panier));
    return `<div class="doc">
      <div class="doc-head">
        <div><strong>${esc(p.nom || 'Nom du praticien')}</strong><br>${esc(p.adresse || 'Adresse du cabinet')}<br>
          ${p.tel ? 'Tél. ' + esc(p.tel) + '<br>' : ''}RPPS : ${esc(p.rpps || '—')} · N° AM : ${esc(p.am || '—')}</div>
        <div><strong>Patient :</strong> ${esc(nom)}<br><strong>Né(e) le :</strong> ${esc(ddn)}<br><strong>Date du devis :</strong> ${today()}</div>
      </div>
      <h1>Devis pour traitement et acte bucco-dentaire</h1>
      <p class="small">Modèle simplifié généré par Dentistory V0, à reporter sur le devis conventionnel de votre logiciel.</p>
      ${lignes.length ? `<table>
        <thead><tr><th>Dent</th><th>Code CCAM</th><th>Acte et matériau</th><th>Panier</th><th class="num">Honoraires</th><th class="num">Base de remb.</th><th class="num">Remb. AMO estimé</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4">Total</td><td class="num">${eur(totHono)}</td><td class="num">${eur(totBase)}</td><td class="num">${eur(totAmo)}</td></tr></tfoot>
      </table>
      <p><strong>Reste à charge avant complémentaire santé :</strong> ${eur(totHono - totAmo)}</p>
      ${alternatives ? '<p>Une alternative thérapeutique sans reste à charge (panier 100 % Santé) ou à tarif maîtrisé a été proposée au patient.</p>' : ''}`
      : '<p>Aucun acte proposé. Passez un acte en « Proposé (devis) » dans l\'onglet Actes CCAM.</p>'}
      <p class="small">Remboursement Assurance Maladie estimé à 70 % (soins) ou 60 % (prothèses) de la base, hors cas particuliers (ALD, C2S...). Montants indicatifs. Devis valable 6 mois.</p>
      <div class="sign"><div>Date et signature du praticien</div><div>Date et signature du patient, précédées de « Lu et accepté »</div></div>
    </div>`;
  }

  function renderDevis() { $('#devis-preview').innerHTML = devisHTML(); }

  function consignesHTML() {
    const p = praticien();
    return `<div class="doc"><div class="doc-head"><div><strong>${esc(p.nom || 'Votre dentiste')}</strong><br>${esc(p.adresse || '')}${p.tel ? '<br>Tél. ' + esc(p.tel) : ''}</div><div>${today()}</div></div>
      <h1>Vos consignes après la séance</h1><div class="consignes-text">${esc($('#consignes').value)}</div></div>`;
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

  // ---------- Événements ----------
  function bind() {
    $('#btn-generate').addEventListener('click', generate);
    $('#btn-example').addEventListener('click', () => {
      $('#dictee').value = window.DEMO.dictee;
      if (!$('#patient-nom').value) $('#patient-nom').value = 'M. D. (fictif)';
    });
    $('#btn-clear').addEventListener('click', () => { $('#dictee').value = ''; setStatus(''); });
    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

    $('#cr-fields').addEventListener('input', (e) => { if (e.target.dataset.key) state.compte_rendu[e.target.dataset.key] = e.target.value; });
    $('#consignes').addEventListener('input', (e) => { state.consignes_patient = e.target.value; });

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
    });
    $('#actes-body').addEventListener('click', (e) => {
      if (e.target.dataset.del == null) return;
      state.actes.splice(Number(e.target.dataset.del), 1);
      renderActes();
      renderAlertes();
    });
    $('#btn-add-acte').addEventListener('click', () => {
      const code = ccam[0].code;
      state.actes.push({ dent: '', code, libelle: ccamByCode[code].libelle, statut: 'propose', honoraires: defaultHonoraires(code) });
      renderActes();
    });

    $('#btn-copy-cr').addEventListener('click', (e) => copy(crText(), e.target));
    $('#btn-copy-consignes').addEventListener('click', (e) => copy($('#consignes').value, e.target));
    $('#btn-print-devis').addEventListener('click', () => printDoc(devisHTML()));
    $('#btn-print-consignes').addEventListener('click', () => printDoc(consignesHTML()));

    const dialog = $('#settings');
    $('#btn-settings').addEventListener('click', () => {
      const p = praticien();
      for (const el of dialog.querySelectorAll('input')) el.value = p[el.name] || '';
      dialog.showModal();
    });
    dialog.addEventListener('close', () => {
      if (dialog.returnValue !== 'save') return;
      const p = {};
      for (const el of dialog.querySelectorAll('input')) p[el.name] = el.value.trim();
      storage.set('dentistory.praticien', p);
      if (state) renderDevis();
    });
  }

  async function init() {
    bind();
    setupMic();
    try {
      ccam = await (await fetch('/api/ccam')).json();
      ccamByCode = Object.fromEntries(ccam.map((a) => [a.code, a]));
    } catch {
      setStatus('Référentiel CCAM indisponible.', true);
    }
  }

  init();
})();
