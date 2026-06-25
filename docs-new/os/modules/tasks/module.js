export const id = 'tasks';
export const label = 'Tasks';
export const icon = 'check-square';

const COLUMNS = [
  { key: 'todo', title: 'To Do' },
  { key: 'in_progress', title: 'In Progress' },
  { key: 'done', title: 'Done' },
];

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  async function render() {
    const tasks = await store.getAll('tasks');
    const filtered = tasks.filter((t) => t.status !== 'backlog' && t.status !== 'review');

    container.innerHTML = `
      <section class="module-page">
        <header class="page-head">
          <div><h1>Tasks</h1><p class="page-sub">Documentation and capstone deliverables — drag cards or double-click to edit.</p></div>
          <button class="btn-primary btn-sm" id="add-task">+ Task</button>
        </header>
        <div class="kanban kanban-3">
          ${COLUMNS.map((c) => {
            const items = filtered.filter((t) => t.status === c.key);
            return `<div class="kanban-col" data-col="${c.key}">
              <h3>${c.title}<span class="badge">${items.length}</span></h3>
              ${items.map((t) => card(t, utils)).join('')}
            </div>`;
          }).join('')}
        </div>
      </section>`;

    bind();
  }

  function bind() {
    container.querySelector('#add-task').onclick = () => openForm();
    container.querySelectorAll('.kanban-card').forEach((el) => {
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', el.dataset.id));
      el.addEventListener('dblclick', () => openForm(el.dataset.id));
    });
    container.querySelectorAll('.kanban-col').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const tid = e.dataTransfer.getData('text/plain');
        const task = await store.get('tasks', tid);
        if (task && task.status !== col.dataset.col) {
          task.status = col.dataset.col;
          await store.put('tasks', task);
          await store.log('Task moved', `${task.id} → ${col.dataset.col}`);
          render();
        }
      });
    });
  }

  async function openForm(taskId) {
    const task = taskId ? await store.get('tasks', taskId) : { id: utils.uid('TASK'), status: 'todo', priority: 'medium', tags: [] };
    const isNew = !taskId;
    const dlg = document.createElement('div');
    dlg.className = 'modal-overlay';
    dlg.innerHTML = `
      <div class="modal card">
        <div class="row between"><h2 style="margin:0">${isNew ? 'New' : 'Edit'} Task</h2><button class="btn-icon" id="m-close">✕</button></div>
        <div class="field"><label>Title</label><input id="m-title" value="${utils.escapeHtml(task.title || '')}"></div>
        <div class="grid grid-2">
          <div class="field"><label>Assignee</label><input id="m-assignee" value="${utils.escapeHtml(task.assignee || '')}"></div>
          <div class="field"><label>Due date</label><input id="m-due" type="date" value="${task.due_date || ''}"></div>
          <div class="field"><label>Status</label><select id="m-status">${COLUMNS.map((c) => `<option value="${c.key}" ${task.status === c.key ? 'selected' : ''}>${c.title}</option>`).join('')}</select></div>
          <div class="field"><label>WBS ref</label><input id="m-wbs" value="${utils.escapeHtml(task.wbs_ref || '')}"></div>
        </div>
        <div class="row between">
          ${isNew ? '<span></span>' : '<button class="btn-danger btn-sm" id="m-delete">Delete</button>'}
          <div class="row"><button class="btn btn-sm" id="m-cancel">Cancel</button><button class="btn-primary btn-sm" id="m-save">Save</button></div>
        </div>
      </div>`;
    container.append(dlg);
    const close = () => dlg.remove();
    dlg.querySelector('#m-close').onclick = close;
    dlg.querySelector('#m-cancel').onclick = close;
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    const del = dlg.querySelector('#m-delete');
    if (del) del.onclick = async () => { await store.delete('tasks', task.id); close(); render(); };
    dlg.querySelector('#m-save').onclick = async () => {
      const updated = {
        ...task,
        title: dlg.querySelector('#m-title').value.trim() || 'Untitled',
        assignee: dlg.querySelector('#m-assignee').value.trim(),
        status: dlg.querySelector('#m-status').value,
        due_date: dlg.querySelector('#m-due').value,
        wbs_ref: dlg.querySelector('#m-wbs').value.trim(),
      };
      await store.put('tasks', updated);
      await store.log(isNew ? 'Task created' : 'Task updated', updated.id);
      close();
      render();
    };
  }

  await render();
}

function card(t, utils) {
  return `<div class="kanban-card" data-id="${t.id}" title="Double-click to edit">
    <div class="kc-title">${utils.escapeHtml(t.title)}</div>
    <div class="kc-meta">
      ${t.assignee ? `<span>${utils.escapeHtml(t.assignee.split(' ')[0])}</span>` : ''}
      ${t.wbs_ref ? `<span class="mono">${utils.escapeHtml(t.wbs_ref)}</span>` : ''}
      ${t.due_date ? `<span>${utils.fmtDate(t.due_date, { month: 'short', day: 'numeric' })}</span>` : ''}
    </div>
  </div>`;
}

export function unmount(container) {
  container.innerHTML = '';
}
