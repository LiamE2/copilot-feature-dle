/* Copilot Feature-dle · icons, mascot ("Pip"), wordmark and brandmark helpers */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});
  const { html, raw, esc } = FD.u;

  /* Brand colours (Engage Squared Brand Guidelines, p12) */
  FD.brand = {
    red: '#DD2E27', yellow: '#F3B029', orange: '#E7662E', purple: '#9C3DB3', blue: '#165AF1', navy: '#12134B',
    pink: '#FA146E', green: '#21C795', black: '#000000', grey: '#414042'
  };

  /* ---------- stroke icons (24x24 grid) ---------- */
  const P = {
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10v9.5h4v-5h3v5h4V10"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3.5"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>',
    shuffle: '<path d="M4 7h3.5c5 0 5 10 10 10H20M4 17h3.5c1.8 0 3-.9 4-2.2M13.5 9.2C14.5 7.9 15.7 7 17.5 7H20"/><path d="m18 4.5 2.5 2.5L18 9.5M18 14.5l2.5 2.5-2.5 2.5"/>',
    timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 9.5v4l2.5 1.5M9.5 3.5h5"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M15.8 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.4a5.5 5.5 0 0 1 3 5.1"/>',
    book: '<path d="M6 3.5h12.5v14.5H6.5A1.5 1.5 0 0 0 5 19.5V5A1.5 1.5 0 0 1 6.5 3.5Z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18.5"/>',
    chart: '<path d="M5.5 20v-7M12 20V4M18.5 20v-10"/>',
    trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5.2c-.4 2.5.9 4.4 3 4.8M16 6h2.8c.4 2.5-.9 4.4-3 4.8M12 13.5V17M8.5 20.5h7M9.5 17h5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.4"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    flame: '<path d="M12 3.2c.8 3.3 5.2 5.3 5.2 10.2a5.2 5.2 0 0 1-10.4 0c0-2 .9-3.4 2-4.6.3 1.5 1 2.4 1.9 2.8C10.6 8.4 11 5.8 12 3.2Z"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8L12 3.5Z"/>',
    sparkle: '<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 10.9 10.1 9 12 3.5Z"/><path d="M19 3.5v3M17.5 5h3"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="3"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
    check: '<path d="m5 12.8 4.4 4.4L19 7.6"/>',
    x: '<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    equals: '<path d="M5.5 9h13M5.5 15h13"/>',
    share: '<circle cx="6.2" cy="12" r="2.6"/><circle cx="17.6" cy="6.2" r="2.6"/><circle cx="17.6" cy="17.8" r="2.6"/><path d="m8.5 10.8 6.8-3.4M8.5 13.2l6.8 3.4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="3"/><path d="M5 15V7a2 2 0 0 1 2-2h8"/>',
    download: '<path d="M12 4v11M7.5 10.8 12 15.3l4.5-4.5M5 20h14"/>',
    upload: '<path d="M12 16V5M7.5 9.2 12 4.7l4.5 4.5M5 20h14"/>',
    external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v4.5a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1H10"/>',
    bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5Z"/>',
    play: '<path d="M8 5.5v13l11-6.5-11-6.5Z"/>',
    volume: '<path d="M4.5 9.5v5h3.2l4.8 3.8V5.7L7.7 9.5H4.5Z"/><path d="M16 9a4 4 0 0 1 0 6M18.6 6.4a7.5 7.5 0 0 1 0 11.2"/>',
    mute: '<path d="M4.5 9.5v5h3.2l4.8 3.8V5.7L7.7 9.5H4.5Z"/><path d="m16 9.5 4.5 5M20.5 9.5l-4.5 5"/>',
    menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m20 20-4.7-4.7"/>',
    user: '<circle cx="12" cy="8.2" r="4"/><path d="M4.5 20.2a7.5 7.5 0 0 1 15 0"/>',
    package: '<path d="M12 3.2 19.8 7v10L12 20.8 4.2 17V7L12 3.2Z"/><path d="M4.5 7.2 12 11l7.5-3.8M12 11v9.5"/>',
    crown: '<path d="M4.5 8.5 8.6 12 12 5.5l3.4 6.5 4.1-3.5-1.4 9.5H5.9L4.5 8.5Z"/>',
    refresh: '<path d="M19.5 11.5a7.5 7.5 0 1 0-2.2 5.3"/><path d="M19.8 5.5v5.7h-5.7"/>',
    trash: '<path d="M5 7h14M9.5 7V4.5h5V7M7 7l.9 12.5h8.2L17 7M10 11v5M14 11v5"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
    snow: '<path d="M12 3.5v17M4.6 7.8l14.8 8.4M4.6 16.2l14.8-8.4"/><path d="m9.8 4.6 2.2 1.8 2.2-1.8M9.8 19.4l2.2-1.8 2.2 1.8"/>',
    right: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    left: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
    chevdown: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    chat: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7.2L8 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z"/>',
    apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
    video: '<rect x="3.5" y="6.5" width="12" height="11" rx="3"/><path d="m15.5 11 5-3v8l-5-3"/>',
    agent: '<rect x="5" y="8" width="14" height="11" rx="4"/><path d="M12 8V5M9.5 13v.5M14.5 13v.5M9.5 16.5h5"/><circle cx="12" cy="4" r="1"/>',
    code: '<path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 5l-3 14"/>',
    shield: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    graduation: '<path d="m2.8 9.5 9.2-4.6 9.2 4.6-9.2 4.6-9.2-4.6Z"/><path d="M6.5 11.8v4.2c0 1.2 2.5 2.6 5.5 2.6s5.5-1.4 5.5-2.6v-4.2M21 9.8v5"/>',
    mobile: '<rect x="7" y="3" width="10" height="18" rx="3"/><path d="M11 18h2"/>',
    pencil: '<path d="m5 19 .8-3.8L16.6 4.4a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8.8 18.2 5 19Z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    medal: '<circle cx="12" cy="14.5" r="5"/><path d="M8.5 10.2 6.5 3.5h4l1.5 4M15.5 10.2l2-6.7h-4L12 7.5"/>',
    bolt: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3Z"/>',
    list: '<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
    offline: '<path d="M3.5 9.5a13 13 0 0 1 17 0M6.5 13a8.5 8.5 0 0 1 11 0M9.5 16.3a4 4 0 0 1 5 0M12 19.5h.01M4 4l16 16"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c2-4 5-7 8-9"/>',
    puzzle: '<path d="M10 4.5a2 2 0 1 1 4 0V6h3.5A1.5 1.5 0 0 1 19 7.5V11h-1.5a2 2 0 1 0 0 4H19v3.5a1.5 1.5 0 0 1-1.5 1.5H14v-1.5a2 2 0 1 0-4 0V20H6.5A1.5 1.5 0 0 1 5 18.5V15h1.5a2 2 0 1 0 0-4H5V7.5A1.5 1.5 0 0 1 6.5 6H10V4.5Z"/>'
  };

  function icon(name, opts = {}) {
    const { size = 24, cls = '', title = '', sw = 2 } = opts;
    const body = P[name] || P.sparkle;
    const a11y = title ? `role="img" aria-label="${esc(title)}"` : 'aria-hidden="true" focusable="false"';
    return raw(`<svg class="ic ic-${name} ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`);
  }
  FD.icon = icon;
  FD.iconNames = Object.keys(P);

  /* ---------- Pip, the bracket-eared guide ---------- */
  function pip(mood = 'hello', opts = {}) {
    const { size = 160, color = 'blue', cls = '' } = opts;
    const body = FD.brand[color] || FD.brand.blue;
    const N = FD.brand.navy, Y = FD.brand.yellow, PK = FD.brand.pink;
    const earC = color === 'yellow' ? N : Y;
    const ears = `<g class="pip-ears" fill="none" stroke="${earC}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M44 80 28 96l16 16"/><path d="M176 80l16 16-16 16"/></g>`;
    const cheeks = `<ellipse cx="80" cy="135" rx="7" ry="4.5" fill="${PK}" opacity=".3"/><ellipse cx="140" cy="135" rx="7" ry="4.5" fill="${PK}" opacity=".3"/>`;
    let eyes, mouth, extra = '';
    const dot = (x, y, r = 7.5, dx = 0, dy = 0) => `<circle cx="${x + dx}" cy="${y + dy}" r="${r}" fill="${N}"/><circle cx="${x + dx + 2.4}" cy="${y + dy - 2.6}" r="2.3" fill="#fff"/>`;
    switch (mood) {
      case 'think':
        eyes = `<g class="pip-eyes">${dot(93, 119, 7.5, 3, -3)}${dot(127, 119, 7.5, 3, -3)}</g>`;
        mouth = `<path d="M101 139h18" stroke="${N}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
        extra = `<circle cx="188" cy="40" r="17" fill="${Y}"/><path d="M182 34a6 6 0 1 1 9 5c-2.4 1.5-3 2.6-3 5" stroke="${N}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="188" cy="52" r="2.6" fill="${N}"/>`;
        break;
      case 'cheer':
        eyes = `<path d="M84 122q8-12 16 0M120 122q8-12 16 0" stroke="${N}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
        mouth = `<path d="M95 132q15 24 30 0Z" fill="${N}"/><path d="M103 144q7 6 14 0q-7-3.5-14 0Z" fill="${PK}"/>`;
        extra = `<circle cx="22" cy="40" r="5" fill="${PK}"/><circle cx="200" cy="64" r="5" fill="#21C795"/><rect x="190" y="18" width="10" height="10" rx="3" fill="${Y}" transform="rotate(25 195 23)"/><rect x="10" y="68" width="10" height="10" rx="3" fill="#9C3DB3" transform="rotate(-20 15 73)"/><path d="M150 26l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z" fill="${Y}"/>`;
        break;
      case 'oops':
        eyes = `<g class="pip-eyes">${dot(93, 120, 7)}${dot(127, 120, 7)}</g><path d="M83 106l16-4M137 106l-16-4" stroke="${N}" stroke-width="4" stroke-linecap="round"/>`;
        mouth = `<path d="M95 141q7.5-8 15 0t15 0" stroke="${N}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
        extra = `<path d="M178 64q10 14 0 22-10-8 0-22Z" fill="#8BADF8"/>`;
        break;
      default: /* hello */
        eyes = `<g class="pip-eyes">${dot(93, 119)}${dot(127, 119)}</g>`;
        mouth = `<path d="M97 134q13 14 26 0" stroke="${N}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
        extra = `<path d="M170 28l4.5 11.5L186 44l-11.5 4.5L170 60l-4.5-11.5L154 44l11.5-4.5L170 28Z" fill="${Y}"/><circle cx="144" cy="34" r="4.5" fill="${PK}"/>`;
    }
    const arms = mood === 'cheer'
      ? `<path d="M54 160 34 128M166 160l20-32" stroke="${body}" stroke-width="15" stroke-linecap="round"/>`
      : `<path d="M54 166 38 184" stroke="${body}" stroke-width="15" stroke-linecap="round"/><path class="pip-wave" d="M166 166l18-14" stroke="${body}" stroke-width="15" stroke-linecap="round"/>`;
    return raw(`<svg class="pip pip-${mood} ${cls}" viewBox="0 0 220 240" width="${size}" height="${Math.round(size * 240 / 220)}" aria-hidden="true" focusable="false">
      <ellipse cx="110" cy="229" rx="58" ry="7" fill="${N}" opacity=".1"/>
      <rect x="70" y="214" width="32" height="14" rx="7" fill="${N}"/><rect x="118" y="214" width="32" height="14" rx="7" fill="${N}"/>
      ${arms}
      <path d="M50 214V104a60 60 0 0 1 120 0v110a10 10 0 0 1-10 10H60a10 10 0 0 1-10-10Z" fill="${body}"/>
      <rect x="68" y="92" width="84" height="66" rx="33" fill="#fff"/>
      ${eyes}${cheeks}${mouth}
      <rect x="86" y="178" width="48" height="9" rx="4.5" fill="#fff" opacity=".28"/>
      ${ears}${extra}
    </svg>`);
  }
  FD.pip = pip;

  /* ---------- wordmark: "Feature-dle" with the -dle in Wordle-style tiles ---------- */
  function wordmark(opts = {}) {
    const { cls = '', kicker = true } = opts;
    return html`<span class="wordmark ${cls}" role="img" aria-label="Copilot Feature-dle">
      ${kicker ? html`<span class="wm-top" aria-hidden="true">Copilot</span>` : ''}
      <span class="wm-main" aria-hidden="true">Feature-<span class="wm-tile wm-t1">d</span><span class="wm-tile wm-t2">l</span><span class="wm-tile wm-t3">e</span></span>
    </span>`;
  }
  FD.wordmark = wordmark;

  /* ---------- Engage Squared brandmark (official artwork extracted from the brand guidelines PDF) ---------- */
  const LOGO = { full: 'assets/img/engage-squared-logo.png', white: 'assets/img/engage-squared-logo-white.png', symbol: 'assets/img/engage-squared-symbol.png' };
  FD.logoSrc = LOGO;
  function logo(opts = {}) {
    const { variant = 'full', width = 160, cls = '' } = opts;
    const src = variant === 'white' ? LOGO.white : LOGO.full;
    const h = Math.round(width * 281 / 1200);
    return html`<img class="es-logo ${cls}" src="${src}" width="${width}" height="${h}" alt="Engage Squared" decoding="async">`;
  }
  FD.logo = logo;

  /* <people> friendly technology - brand tagline device */
  const tagline = (word = 'people', cls = '') => html`<span class="tagline ${cls}">&lt;${word}&gt; friendly technology</span>`;
  FD.tagline = tagline;

  /* initials avatar */
  function avatar(name, color = 'blue', size = 40) {
    const parts = String(name || '?').trim().split(/\s+/);
    const ini = ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    return html`<span class="avatar c-${color}" style="--sz:${size}px" aria-hidden="true">${ini}</span>`;
  }
  FD.avatar = avatar;
})();
