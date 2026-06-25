// Normalized image template paths for people, tech icons, and manuscript figures.

const BASE = '';

export const people = {
  adviser: `${BASE}os/assets/people/adviser.png`,
  'tm-1': `${BASE}os/assets/people/tm-1.png`,
  'tm-2': `${BASE}os/assets/people/tm-2.png`,
  'tm-3': `${BASE}os/assets/people/tm-3.png`,
  'tm-4': `${BASE}os/assets/people/tm-4.png`,
};

export const figures = {
  orgChart: `${BASE}documentation/chapter2/assets/figures/fig-2a1-org-chart.png`,
  wbsSummary: `${BASE}documentation/chapter2/assets/figures/fig-2a1b-wbs-summary.png`,
  gantt: `${BASE}documentation/chapter2/assets/figures/fig-2a2-gantt.png`,
};

export const tech = {
  django: `${BASE}documentation/chapter2/assets/tech/django.svg`,
  react: `${BASE}documentation/chapter2/assets/tech/react.svg`,
  typescript: `${BASE}documentation/chapter2/assets/tech/typescript.svg`,
  postgresql: `${BASE}documentation/chapter2/assets/tech/postgresql.svg`,
  yolo: `${BASE}documentation/chapter2/assets/tech/yolo.svg`,
  mediapipe: `${BASE}documentation/chapter2/assets/tech/mediapipe.svg`,
  arcface: `${BASE}documentation/chapter2/assets/tech/arcface.svg`,
  vscode: `${BASE}documentation/chapter2/assets/tech/vscode.svg`,
};

export function personAvatar(memberOrKey, fallbackName = '?') {
  const key = typeof memberOrKey === 'string' ? memberOrKey : memberOrKey?.id;
  const src = people[key] || '';
  const initials = (fallbackName || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return `<span class="avatar-wrap" data-avatar="${key}">
    <img class="avatar-img" src="${src}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/>
    <span class="avatar-fallback" hidden>${initials}</span>
  </span>`;
}

export function orgChartHtml(advisor, members, escapeHtml) {
  const team = members.slice(0, 4);
  const pm = team.find((m) => /manager/i.test(m.role)) || team[0];
  const rest = team.filter((m) => m.id !== pm?.id);
  const adv = escapeHtml(advisor?.name || 'Adviser');
  const advTitle = escapeHtml(advisor?.title || 'Project Adviser');

  const node = (m) => m ? `<div class="org-node">
    ${personAvatar(m.id, m.name)}
    <strong>${escapeHtml(m.name)}</strong>
    <span class="muted">${escapeHtml(m.role)}</span>
  </div>` : '';

  return `<div class="org-chart">
    <div class="org-level">${personAvatar('adviser', advisor?.name)}<div><strong>${adv}</strong><span class="muted">${advTitle}</span></div></div>
    <div class="org-connector"></div>
    <div class="org-level">${node(pm)}</div>
    <div class="org-connector org-fan"></div>
    <div class="org-level org-row">${rest.map(node).join('')}</div>
  </div>`;
}
