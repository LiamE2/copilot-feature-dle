/* Copilot Feature-dle · Packs & themes: official packs, monthly spotlights, community / AI-generated packs */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, flat, $, $$, mount } = FD.u;
  const ui = FD.ui;

  const TEMPLATE = {
    name: 'My team pack',
    description: 'Copilot features our team should know.',
    author: 'Your name',
    features: [{
      name: 'Example Feature',
      aliases: ['Example', 'Sample Feature'],
      difficulty: 'Medium',
      category: 'My category',
      tags: ['example'],
      hints: [
        'The sneakiest clue goes first. Avoid the feature\u2019s name.',
        'Each hint gets a little more obvious.',
        'Hint three can mention what it helps people do.',
        'Hint four points to where you would find it.',
        'The last hint is almost a giveaway.'
      ],
      description: 'One or two sentences on what the feature does.',
      why: 'One or two sentences on why it matters at work.',
      useCases: [
        { title: 'Scenario one', text: 'A short, practical workplace example.' },
        { title: 'Scenario two', text: 'Another everyday example.' },
        { title: 'Scenario three', text: 'A third example.' }
      ],
      prompt: 'An authentic prompt someone could paste into Copilot.',
      learnMore: 'https://learn.microsoft.com/'
    }]
  };

  const aiPrompt = () => `You are helping me build a feature pack for "Copilot Feature-dle", a friendly Wordle-style game that teaches people Microsoft Copilot features.

Topic for my pack: [REPLACE THIS: e.g. "Copilot in Excel for finance teams" or "features our sales team should know"]

Rules:
- Reply with ONLY valid JSON. No commentary and no code fences.
- Include 6 to 8 features. Each must be real, current and accurate. Never invent a feature: if you are not sure, leave it out.
- Use friendly, human, plain Australian English. No unexplained jargon.
- For each feature provide:
  "name" (official name), "aliases" (2-4 other names people use), "difficulty" (Easy = common features, Medium = newer features, Hard = niche or recent, Expert = champion/consultant territory), "category", "tags" (1-3 lowercase words),
  "hints" (exactly 5, from deliberately obscure to nearly obvious; do NOT put the feature's name in hints 1-3),
  "description" (1-2 sentences: what it does), "why" (1-2 sentences: why it matters at work),
  "useCases" (exactly 3 objects with "title" and "text": practical workplace scenarios),
  "prompt" (one realistic example prompt someone could paste into Copilot),
  "learnMore" (an official https://learn.microsoft.com or https://support.microsoft.com link you are confident exists).

Shape:
{ "name": "Pack name", "description": "One line about the pack", "author": "My name", "features": [ { ...feature... } ] }`;

  FD.views.packs = {
    title: 'Packs & themes',
    render(main) {
      const lib = FD.lib, month = new Date().getMonth() + 1;
      const official = lib.packs.filter((p) => p.kind !== 'community');
      const community = FD.store.community();
      let preview = null;

      const draw = () => {
        main.innerHTML = flat(html`<div class="container hub">
          <header class="hub-head"><p class="eyebrow">Extend the game</p><h1>Packs &amp; themes</h1><p class="lede">Themed sets of features for events, release waves and monthly spotlights \u2013 plus your own packs, written by you or with a little help from Copilot.</p></header>

          ${ui.section('Official packs', html`<div class="pack-grid">${official.map((p) => { const n = FD.data.packFeatures(p.id).length; return html`<article class="pack-card c-${p.color || 'blue'}"><span class="pack-ic" aria-hidden="true">${FD.icon(p.icon || 'package', { size: 28 })}</span><div><h3>${p.name}</h3><p>${p.description}</p><p class="pack-n">${FD.u.plural(n, 'feature')}</p></div><a class="btn btn-dark btn-sm" href="#/free?pack=${p.id}&start=1">${FD.icon('play', { size: 16 })}Play</a></article>`; })}</div>`, { id: 'pk-off' })}

          ${ui.section('Monthly spotlights', html`<ol class="theme-list">${(lib.themes || []).slice().sort((a, b) => a.month - b.month).map((t) => { const n = FD.data.pool({ tag: t.tag }).length; const name = new Date(2026, t.month - 1, 1).toLocaleDateString('en-AU', { month: 'long' }); return html`<li class="theme c-${t.color || 'blue'} ${t.month === month ? 'is-now' : ''}"><span class="theme-month">${name}</span><div><h3>${t.title}${t.month === month ? html` <span class="chip chip-solid c-green">This month</span>` : ''}</h3><p>${t.blurb}</p></div>${n ? html`<a class="btn btn-ghost btn-sm" href="#/free?tag=${t.tag}&start=1">Play ${n}</a>` : html`<span class="muted small">Coming soon</span>`}</li>`; })}</ol>`, { id: 'pk-themes' })}

          ${ui.section('Community & AI-generated packs', html`
            ${community.length ? html`<ul class="community-list">${community.map((c) => html`<li class="card"><div><h3>${c.name}</h3><p class="muted">${c.description}${c.author ? html` \u00B7 by ${c.author}` : ''} \u00B7 ${FD.u.plural(c.features.length, 'feature')}</p></div><div class="btn-row"><a class="btn btn-primary btn-sm" href="#/free?pack=${c.id}&start=1">Play</a><button class="btn btn-ghost btn-sm" type="button" data-action="pack-remove" data-id="${c.id}">${FD.icon('trash', { size: 16 })}Remove</button></div></li>`)}</ul>` : html`<p class="muted">No community packs yet. Add one below!</p>`}
            <div class="card creator" aria-labelledby="cr-h">
              <h3 id="cr-h">Create your own pack with Copilot</h3>
              <ol class="creator-steps">
                <li><strong>Copy the prompt.</strong> Paste it into Copilot Chat and swap in your topic.
                  <details class="prompt-box"><summary>Show the prompt</summary><pre tabindex="0">${aiPrompt()}</pre></details>
                  <div class="btn-row"><button class="btn btn-dark btn-sm" type="button" data-action="copy" data-copy="${aiPrompt()}">${FD.icon('copy', { size: 16 })}Copy prompt</button><button class="btn btn-ghost btn-sm" type="button" data-action="pack-template">${FD.icon('download', { size: 16 })}Download a template</button></div></li>
                <li><strong>Check Copilot\u2019s work.</strong> Make sure each feature and link is accurate. You know your audience best.</li>
                <li><strong>Paste the JSON here.</strong>
                  <label class="sr-only" for="pack-json">Pack JSON</label>
                  <textarea id="pack-json" class="textarea" rows="8" spellcheck="false" placeholder='{ "name": "My pack", "features": [ ... ] }'></textarea>
                  <div class="btn-row"><button class="btn btn-primary" type="button" data-action="pack-check">${FD.icon('check', { size: 18 })}Check my pack</button><label class="btn btn-ghost" for="pack-file">${FD.icon('upload', { size: 18 })}Load a .json file</label><input id="pack-file" class="sr-only" type="file" accept="application/json,.json"></div>
                  <div id="pack-report" aria-live="polite"></div></li>
              </ol>
            </div>`, { id: 'pk-com' })}
        </div>`);
        $('#pack-file', main).addEventListener('change', (e) => {
          const file = e.target.files[0]; if (!file) return;
          const r = new FileReader(); r.onload = () => { $('#pack-json', main).value = String(r.result); check(); }; r.readAsText(file);
        });
      };

      function check() {
        const box = $('#pack-json', main), out = $('#pack-report', main);
        let json;
        const txt = box.value.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
        try { json = JSON.parse(txt); } catch (e) { preview = null; out.innerHTML = flat(html`<div class="banner c-red">${FD.icon('x', { size: 20 })}<p>That isn\u2019t valid JSON yet (${e.message}). Copy only the JSON from Copilot\u2019s reply.</p></div>`); return; }
        const v = FD.data.validatePack(json);
        preview = v.ok ? v.pack : null;
        out.innerHTML = flat(html`
          ${v.errors.length ? html`<div class="banner c-red">${FD.icon('x', { size: 20 })}<div><strong>Needs a tweak</strong><ul>${v.errors.map((m) => html`<li>${m}</li>`)}</ul></div></div>` : ''}
          ${v.warnings.length ? html`<div class="banner c-yellow">${FD.icon('info', { size: 20 })}<div><strong>Heads up</strong><ul>${v.warnings.slice(0, 8).map((m) => html`<li>${m}</li>`)}</ul></div></div>` : ''}
          ${v.ok ? html`<div class="banner c-green">${FD.icon('check', { size: 20 })}<div><strong>Looks good!</strong> ${v.pack.name} has ${FD.u.plural(v.pack.features.length, 'feature')}:
            <ul class="preview-list">${v.pack.features.map((f) => html`<li><strong>${f.name}</strong> <span class="muted">\u00B7 ${f.difficulty || 'Medium'} \u00B7 \u201C${(f.hints || [])[0]}\u201D</span></li>`)}</ul>
            <div class="btn-row"><button class="btn btn-primary" type="button" data-action="pack-add">${FD.icon('plus', { size: 18 })}Add this pack</button></div></div></div>` : ''}`);
      }

      ui.actions['pack-check'] = check;
      ui.actions['pack-add'] = () => {
        if (!preview) return;
        const earned = FD.store.addCommunityPack(preview);
        ui.toast(`${preview.name} added!`, { icon: 'package' }); ui.celebrate({ newBadges: earned });
        preview = null; draw();
      };
      ui.actions['pack-remove'] = async (el) => { if (await ui.confirm('Remove this pack?', 'Its features disappear from the game. Your Feature Book progress for them is kept.', 'Remove pack', true)) { FD.store.removeCommunityPack(el.dataset.id); draw(); } };
      ui.actions['pack-template'] = () => FD.u.download(JSON.stringify(TEMPLATE, null, 2), 'feature-dle-pack-template.json', 'application/json');
      draw();
    }
  };
})();
