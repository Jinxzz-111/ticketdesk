const API = '/api/tickets/';
const $ = (id) => document.getElementById(id);
$('build').textContent = window.BUILD || 'dev';

// ---- Dark mode (remembers the choice in this browser) ----
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme').textContent = dark ? 'Light mode' : 'Dark mode';
}
let savedDark = false;
try { savedDark = localStorage.getItem('theme') === 'dark'; } catch (_) {}
applyTheme(savedDark);
$('theme').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  applyTheme(dark);
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (_) {}
};

// ---- Tickets: load once, then filter / sort / draw from memory ----
const RANK = { high: 3, medium: 2, low: 1 };
let allTickets = [];

function visibleTickets() {
  const q = $('search').value.trim().toLowerCase();
  const pr = $('filter').value;
  const shown = allTickets.filter((t) =>
    (pr === 'all' || t.priority === pr) && (!q || t.title.toLowerCase().includes(q)));
  if ($('sort').value === 'priority') shown.sort((a, b) => RANK[b.priority] - RANK[a.priority] || b.id - a.id);
  else shown.sort((a, b) => b.id - a.id);
  return shown;
}

function render() {
  const list = $('list');
  list.replaceChildren();
  const tickets = visibleTickets();
  if (!tickets.length) {
    list.textContent = allTickets.length ? 'No requests match your search.' : 'No requests yet. Submit the first one.';
    return;
  }
  for (const t of tickets) {
    const li = document.createElement('li');
    li.className = 'p-' + t.priority;
    const h = document.createElement('strong');
    h.textContent = `#${t.id} ${t.title}`;
    const meta = document.createElement('span');
    meta.textContent = `${t.requester} · ${t.priority} priority`;
    // Shows only when the database/API provide resolved_at (the "resolved on" feature)
    if (t.status === 'resolved' && t.resolved_at) {
      meta.textContent += ` · Finished on ${new Date(t.resolved_at).toLocaleDateString()}`;
    }
    const sel = document.createElement('select');
    for (const s of ['open', 'in_progress', 'resolved']) {
      const o = document.createElement('option');
      o.value = s; o.textContent = s.replace('_', ' '); o.selected = t.status === s;
      sel.append(o);
    }
    sel.onchange = async () => {
      await fetch(`${API}${t.id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: sel.value }) });
      load();
    };
    li.append(h, meta, sel);
    list.append(li);
  }
}

async function load() {
  allTickets = await (await fetch(API)).json();
  render();
}

$('search').oninput = render;
$('filter').onchange = render;
$('sort').onchange = render;

// ---- Submit form ----
$('form').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = { title: $('title').value, description: $('description').value, requester: $('requester').value || undefined, priority: $('priority').value };
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      $('msg').textContent = 'Request submitted.';
      form.reset();
    } else {
      let detail = 'server returned ' + r.status;
      try { detail = (await r.json()).errors.join(', '); } catch (_) {}
      $('msg').textContent = 'Could not submit: ' + detail;
    }
  } catch (err) {
    $('msg').textContent = 'Could not reach the server: ' + err.message;
  }
  load().catch(() => {});
};

// ---- Auto-refresh every 10 s (skipped while you are using a status dropdown) ----
setInterval(() => {
  const a = document.activeElement;
  if (a && a.tagName === 'SELECT' && $('list').contains(a)) return;
  load().catch(() => {});
}, 10000);

load().catch(() => {});
