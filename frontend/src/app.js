const API = '/api/tickets/';
const $ = (id) => document.getElementById(id);
$('build').textContent = window.BUILD || 'dev';

// ---- Dark mode (moon / sun icon, top right; position and look are in style.css) ----
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme').textContent = dark ? '\u2600\uFE0F' : '\uD83C\uDF19';
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
const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
let allTickets = [];

function visibleTickets() {
  const q = $('search').value.trim().toLowerCase();
  const pr = $('filter').value.toLowerCase();
  const shown = allTickets.filter((t) =>
    (pr === 'all' || (t.priority && t.priority.toLowerCase() === pr)) &&
    (!q || t.title.toLowerCase().includes(q)));
  if ($('sort').value === 'priority') shown.sort((a, b) => (RANK[b.priority] || 0) - (RANK[a.priority] || 0) || b.id - a.id);
  else shown.sort((a, b) => b.id - a.id);
  return shown;
}

async function setStatus(id, status) {
  try {
    await fetch(`${API}${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  } catch (err) { console.error('Could not update status:', err); }
  load();
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function createCard(t, isResolved) {
  const li = el('li', 'ticket p-' + (t.priority || 'medium') + (isResolved ? ' is-resolved' : ''));

  // Left: title, who and priority, details
  const info = el('div', 'ticket-info');
  info.append(
    el('strong', 'ticket-title', `#${t.id} - ${t.title}`),
    el('span', 'ticket-meta', `${t.requester || 'Anonymous'} \u00B7 ${cap(t.priority || 'medium')} Priority`)
  );
  if (t.description) info.append(el('p', 'ticket-desc', t.description));
  li.append(info);

  // Right: status dropdown + Mark as Resolved, or Finished date + Reopen
  const actions = el('div', 'ticket-actions');
  if (!isResolved) {
    const sel = el('select');
    for (const s of ['open', 'in_progress']) {
      const o = el('option', '', STATUS_LABEL[s]);
      o.value = s; o.selected = t.status === s;
      sel.append(o);
    }
    sel.onchange = () => setStatus(t.id, sel.value);
    const resolveBtn = el('button', 'btn-resolve', 'Mark as Resolved');
    resolveBtn.type = 'button';
    resolveBtn.onclick = () => setStatus(t.id, 'resolved');
    actions.append(sel, resolveBtn);
  } else {
    if (t.resolved_at) actions.append(el('span', 'ticket-finished', `Finished: ${new Date(t.resolved_at).toLocaleDateString()}`));
    const delBtn = el('button', 'btn-delete', '\u00D7');   // the X in the upper right corner
    delBtn.type = 'button';
    delBtn.title = 'Delete this request';
    delBtn.setAttribute('aria-label', `Delete request #${t.id}`);
    delBtn.onclick = () => askDelete(t);
    li.append(delBtn);
    const reopenBtn = el('button', 'btn-reopen', 'Reopen');
    reopenBtn.type = 'button';
    reopenBtn.onclick = () => setStatus(t.id, 'open');
    actions.append(reopenBtn);
  }
  li.append(actions);
  return li;
}

function render() {
  const list = $('list');
  list.replaceChildren();
  const tickets = visibleTickets();
  if (!tickets.length) {
    list.append(el('li', 'empty-note', allTickets.length ? 'No requests match your search.' : 'No requests yet. Submit the first one.'));
    return;
  }
  // Active requests first, finished ones in their own section at the bottom
  for (const t of tickets.filter((x) => x.status !== 'resolved')) list.append(createCard(t, false));
  const resolved = tickets.filter((x) => x.status === 'resolved');
  if (resolved.length) {
    list.append(el('li', 'history-title', 'History of Finished Requests'));
    for (const t of resolved) list.append(createCard(t, true));
  }
}

async function load() {
  try {
    const res = await fetch(API);
    if (res.ok) { allTickets = await res.json(); render(); }
  } catch (err) { console.error('Error loading tickets:', err); }
}

$('search').oninput = render;
$('filter').onchange = render;
$('sort').onchange = render;

// ---- Delete a finished request (asks Yes / No first) ----
let pendingDelete = null;
function askDelete(t) {
  pendingDelete = t;
  $('confirm-text').textContent = `#${t.id} - ${t.title}`;
  $('confirm-error').textContent = '';
  $('confirm-yes').disabled = false;
  $('confirm').showModal();
}
$('confirm-no').onclick = () => $('confirm').close();
$('confirm').addEventListener('close', () => { pendingDelete = null; });   // also runs when Esc is pressed
$('confirm-yes').onclick = async () => {
  if (!pendingDelete) return;
  $('confirm-yes').disabled = true;
  try {
    const r = await fetch(`${API}${pendingDelete.id}`, { method: 'DELETE' });
    if (r.ok) {
      $('confirm').close();
      load();
      return;
    }
    let detail = 'server returned ' + r.status;
    try { detail = (await r.json()).errors.join(', '); } catch (_) {}
    $('confirm-error').textContent = 'Could not delete: ' + detail;
  } catch (err) {
    $('confirm-error').textContent = 'Could not reach the server: ' + err.message;
  }
  $('confirm-yes').disabled = false;
};

// ---- Submit form (the dropdown shows Low / Medium / High; the value sent is lowercase) ----
$('form').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {
    title: $('title').value,
    description: $('description').value,
    requester: $('requester').value || undefined,
    priority: $('priority').value.toLowerCase()
  };
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

// ---- Auto-refresh every 10 s (paused while you are typing or using a dropdown) ----
setInterval(() => {
  const a = document.activeElement;
  if (a && ['SELECT', 'INPUT', 'TEXTAREA'].includes(a.tagName)) return;
  load().catch(() => {});
}, 10000);

load().catch(() => {});
