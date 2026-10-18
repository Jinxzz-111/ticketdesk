const API = '/api/tickets/';
const $ = (id) => document.getElementById(id);
$('build').textContent = window.BUILD || 'dev';

async function load() {
  const tickets = await (await fetch(API)).json();
  const list = $('list');
  list.replaceChildren();
  if (!tickets.length) { list.textContent = 'No requests yet. Submit the first one.'; return; }
  for (const t of tickets) {
    const li = document.createElement('li');
    li.className = 'p-' + t.priority;
    const h = document.createElement('strong');
    h.textContent = `#${t.id} ${t.title}`;
    const meta = document.createElement('span');
    meta.textContent = `${t.requester} · ${t.priority} priority`;
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
load();
