/**
 * Options page logic for TextFlow
 */

let snippets = [];
let folders = [];
let tags = [];
let currentSort = 'updated-desc';
let currentFolderFilter = 'all';
let activeTagFilters = new Set();

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const ICONS = {
  sun: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  edit: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>`,
  trash: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`
};

function showToast(msg, type = 'success') {
  const t = $('#optToast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/** Modern multi-tag picker */
function createTagPicker({ selectedEl, fieldEl, suggestionsEl, getAllTags }) {
  let selected = [];
  let activeIdx = -1;

  function normalize(name) {
    return (name || '').trim().toLowerCase();
  }

  function getSelected() {
    return [...selected];
  }

  function setSelected(list) {
    selected = (list || []).map(normalize).filter(Boolean);
    renderSelected();
    hideSuggestions();
  }

  function addTag(name) {
    name = normalize(name);
    if (!name || selected.includes(name)) return;
    selected.push(name);
    fieldEl.value = '';
    activeIdx = -1;
    renderSelected();
    hideSuggestions();
  }

  function removeTag(name) {
    selected = selected.filter(t => t !== name);
    renderSelected();
  }

  function renderSelected() {
    const all = getAllTags() || [];
    selectedEl.innerHTML = selected.map(name => {
      const meta = all.find(t => t.name === name);
      const color = meta?.color || 'var(--accent)';
      return `<span class="tag-badge" style="background:${color}22;color:${color}">
        ${escapeHtml(name)}
        <button type="button" class="tag-remove" data-tag="${escapeHtml(name)}" aria-label="Remove">×</button>
      </span>`;
    }).join('');
  }

  function showSuggestions(query) {
    query = normalize(query);
    const all = getAllTags() || [];
    const available = all.filter(t => !selected.includes(t.name));
    let items = available;
    if (query) {
      items = available.filter(t => t.name.includes(query));
    }
    const exactExists = all.some(t => t.name === query) || selected.includes(query);
    let html = items.slice(0, 8).map((t, i) =>
      `<div class="tag-suggestion${i === activeIdx ? ' active' : ''}" data-tag="${escapeHtml(t.name)}">
        <span class="suggest-dot" style="background:${t.color || 'var(--accent)'}"></span>
        ${escapeHtml(t.name)}
      </div>`
    ).join('');
    if (query && !exactExists) {
      const createIdx = items.length;
      html += `<div class="tag-suggestion${activeIdx === createIdx ? ' active' : ''}" data-create="${escapeHtml(query)}">
        <span class="suggest-create">+ Create “${escapeHtml(query)}”</span>
      </div>`;
    }
    if (!html) {
      hideSuggestions();
      return;
    }
    suggestionsEl.innerHTML = html;
    suggestionsEl.classList.add('open');
  }

  function hideSuggestions() {
    suggestionsEl.classList.remove('open');
    suggestionsEl.innerHTML = '';
    activeIdx = -1;
  }

  selectedEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-remove');
    if (btn) removeTag(btn.dataset.tag);
  });

  fieldEl.addEventListener('input', () => {
    activeIdx = -1;
    showSuggestions(fieldEl.value);
  });

  fieldEl.addEventListener('focus', () => showSuggestions(fieldEl.value));

  fieldEl.addEventListener('keydown', (e) => {
    const opts = suggestionsEl.querySelectorAll('.tag-suggestion');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!suggestionsEl.classList.contains('open')) showSuggestions(fieldEl.value);
      activeIdx = Math.min(activeIdx + 1, opts.length - 1);
      showSuggestions(fieldEl.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      showSuggestions(fieldEl.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && opts[activeIdx]) {
        const el = opts[activeIdx];
        if (el.dataset.create) addTag(el.dataset.create);
        else if (el.dataset.tag) addTag(el.dataset.tag);
      } else if (fieldEl.value.trim()) {
        addTag(fieldEl.value);
      }
    } else if (e.key === 'Backspace' && !fieldEl.value && selected.length) {
      removeTag(selected[selected.length - 1]);
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  suggestionsEl.addEventListener('mousedown', (e) => {
    e.preventDefault(); // keep focus on input
    const el = e.target.closest('.tag-suggestion');
    if (!el) return;
    if (el.dataset.create) addTag(el.dataset.create);
    else if (el.dataset.tag) addTag(el.dataset.tag);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tag-input')) hideSuggestions();
  });

  return { getSelected, setSelected, addTag };
}


async function loadTheme() {
  const s = await Storage.getSettings();
  document.documentElement.setAttribute('data-theme', s.theme || 'light');
  updateThemeIcon(s.theme || 'light');
  if ($('#settingTheme')) $('#settingTheme').value = s.theme || 'light';
}

function updateThemeIcon(theme) {
  const btn = $('#themeToggle');
  if (btn) btn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
}

async function toggleTheme() {
  const s = await Storage.getSettings();
  s.theme = s.theme === 'dark' ? 'light' : 'dark';
  await Storage.saveSettings(s);
  document.documentElement.setAttribute('data-theme', s.theme);
  updateThemeIcon(s.theme);
  if ($('#settingTheme')) $('#settingTheme').value = s.theme;
}

function setupNav() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('.nav-item').forEach(i => i.classList.remove('active'));
      $$('.section').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      $(`#section-${item.dataset.section}`).classList.add('active');
    });
  });
}

async function loadAll() {
  [snippets, folders, tags] = await Promise.all([
    Storage.getSnippets(),
    Storage.getFolders(),
    Storage.getTags()
  ]);
  populateFolderSelects();
  renderTagFilters();
  renderTable();
  renderFolders();
  renderTags();
}

function populateFolderSelects() {
  const opts = `<option value="">Uncategorized</option>` +
    folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
  const filterOpts = `<option value="all">All folders</option><option value="">Uncategorized</option>` +
    folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
  if ($('#optFolder')) $('#optFolder').innerHTML = opts;
  if ($('#optFolderFilter')) {
    $('#optFolderFilter').innerHTML = filterOpts;
    $('#optFolderFilter').value = currentFolderFilter;
  }
}

function renderTagFilters() {
  const el = $('#optTagFilters');
  if (!el) return;
  if (!tags.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = tags.map(t => {
    const active = activeTagFilters.has(t.name) ? 'active' : '';
    const color = t.color || '#2E6F40';
    const style = active
      ? `background:${color}33;color:${color};border-color:${color}`
      : `background:${color}18;color:${color};border-color:${color}44`;
    return `<button class="tag-chip ${active}" data-tag="${escapeHtml(t.name)}" style="${style}">${escapeHtml(t.name)}</button>`;
  }).join('');
}

function getFilteredSorted() {
  let list = [...snippets];
  const q = ($('#optSearch')?.value || '').trim().toLowerCase();
  if (q) {
    list = list.filter(s =>
      s.shortcut.toLowerCase().includes(q) ||
      s.expansion.toLowerCase().includes(q) ||
      (s.tags || []).some(t => t.includes(q))
    );
  }
  if (currentFolderFilter === '') list = list.filter(s => !s.folderId);
  else if (currentFolderFilter !== 'all') list = list.filter(s => s.folderId === currentFolderFilter);

  if (activeTagFilters.size > 0) {
    list = list.filter(s => [...activeTagFilters].every(t => (s.tags || []).includes(t)));
  }

  const [field, dir] = currentSort.split('-');
  list.sort((a, b) => {
    let va, vb;
    if (field === 'updated') { va = a.updated; vb = b.updated; }
    else if (field === 'shortcut') { va = a.shortcut.toLowerCase(); vb = b.shortcut.toLowerCase(); }
    else { va = a.usageCount || 0; vb = b.usageCount || 0; }
    return dir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
  });
  return list;
}

function renderTable() {
  const list = getFilteredSorted();
  const tbody = $('#optTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No snippets found</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => {
    const folder = folders.find(f => f.id === s.folderId);
    const folderLabel = folder
      ? `<span class="folder-badge"><span class="folder-dot" style="background:${folder.color};width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px"></span>${escapeHtml(folder.name)}</span>`
      : '<span class="text-muted">—</span>';
    return `
    <tr data-id="${s.id}">
      <td class="shortcut-cell"><span class="shortcut-pill">${escapeHtml(s.shortcut)}</span></td>
      <td class="expansion-cell" title="${escapeHtml(s.expansion)}">${escapeHtml(s.expansion)}</td>
      <td>${folderLabel}</td>
      <td>${(s.tags || []).map(t => {
        const meta = tags.find(x => x.name === t);
        const color = meta?.color || '#2E6F40';
        return `<span class="badge" style="background:${color}22;color:${color}">${escapeHtml(t)}</span>`;
      }).join(' ')}</td>
      <td>${s.usageCount || 0}</td>
      <td class="actions-cell">
        <button class="btn-icon btn-ghost" data-action="edit" title="Edit">${ICONS.edit}</button>
        <button class="btn-icon btn-ghost" data-action="delete" title="Delete">${ICONS.trash}</button>
      </td>
    </tr>`;
  }).join('');
}

// ---------- Folders ----------
function renderFolders() {
  const el = $('#foldersList');
  if (!folders.length) {
    el.innerHTML = `<div class="empty-state"><p>No folders yet. Create one above.</p></div>`;
    return;
  }
  el.innerHTML = folders.map(f => {
    const count = snippets.filter(s => s.folderId === f.id).length;
    return `
    <div class="entity-card" data-id="${f.id}">
      <span class="entity-color" style="background:${f.color}"></span>
      <span class="entity-name">${escapeHtml(f.name)}</span>
      <span class="entity-meta">${count} snippet${count !== 1 ? 's' : ''}</span>
      <div class="entity-actions">
        <button class="btn-icon btn-ghost" data-action="edit-folder" title="Edit">${ICONS.edit}</button>
        <button class="btn-icon btn-ghost" data-action="delete-folder" title="Delete">${ICONS.trash}</button>
      </div>
    </div>`;
  }).join('');
}

// ---------- Tags ----------
function renderTags() {
  const el = $('#tagsList');
  if (!tags.length) {
    el.innerHTML = `<div class="empty-state"><p>No tags yet. Create one above.</p></div>`;
    return;
  }
  el.innerHTML = tags.map(t => {
    const count = snippets.filter(s => (s.tags || []).includes(t.name)).length;
    return `
    <div class="entity-card" data-id="${t.id}">
      <span class="entity-color" style="background:${t.color}"></span>
      <span class="entity-name">${escapeHtml(t.name)}</span>
      <span class="entity-meta">${count} use${count !== 1 ? 's' : ''}</span>
      <div class="entity-actions">
        <button class="btn-icon btn-ghost" data-action="edit-tag" title="Edit">${ICONS.edit}</button>
        <button class="btn-icon btn-ghost" data-action="delete-tag" title="Delete">${ICONS.trash}</button>
      </div>
    </div>`;
  }).join('');
}

// ---------- Snippet modal ----------
let optTagPicker = null;

function openSnippetModal(id = null) {
  const isEdit = !!id;
  $('#optModalTitle').textContent = isEdit ? 'Edit Snippet' : 'New Snippet';
  $('#optDelete').classList.toggle('hidden', !isEdit);
  if (!optTagPicker) {
    optTagPicker = createTagPicker({
      selectedEl: $('#optTagSelected'),
      fieldEl: $('#optTagField'),
      suggestionsEl: $('#optTagSuggestions'),
      getAllTags: () => tags
    });
  }
  if (isEdit) {
    const s = snippets.find(x => x.id === id);
    $('#optEditId').value = id;
    $('#optShortcut').value = s.shortcut;
    $('#optExpansion').value = s.expansion;
    $('#optFolder').value = s.folderId || '';
    optTagPicker.setSelected(s.tags || []);
  } else {
    $('#optEditId').value = '';
    $('#optShortcut').value = '';
    $('#optExpansion').value = '';
    $('#optFolder').value = '';
    optTagPicker.setSelected([]);
  }
  $('#optModal').classList.add('open');
  $('#optShortcut').focus();
}

function closeSnippetModal() {
  $('#optModal').classList.remove('open');
}

async function saveSnippet() {
  const id = $('#optEditId').value;
  const shortcut = $('#optShortcut').value.trim();
  const expansion = $('#optExpansion').value;
  const folderId = $('#optFolder').value || null;
  const tagsList = optTagPicker ? optTagPicker.getSelected() : [];
  if (!shortcut || !expansion) {
    showToast('Shortcut and expansion required', 'error');
    return;
  }
  if (snippets.some(s => s.shortcut === shortcut && s.id !== id)) {
    showToast('Shortcut already exists', 'error');
    return;
  }
  if (id) {
    await Storage.updateSnippet(id, { shortcut, expansion, tags: tagsList, folderId });
    showToast('Updated');
  } else {
    await Storage.addSnippet({ shortcut, expansion, tags: tagsList, folderId });
    showToast('Created');
  }
  closeSnippetModal();
  await loadAll();
}

async function deleteSnippet(id) {
  if (!confirm('Delete this snippet?')) return;
  await Storage.deleteSnippet(id);
  showToast('Deleted');
  closeSnippetModal();
  await loadAll();
}

// ---------- Entity (folder/tag) modal ----------
function openEntityModal(type, id = null) {
  $('#entityType').value = type;
  $('#entityId').value = id || '';
  $('#entityModalTitle').textContent = id ? `Edit ${type}` : `New ${type}`;
  if (id) {
    const list = type === 'folder' ? folders : tags;
    const item = list.find(x => x.id === id);
    $('#entityName').value = item.name;
    $('#entityColor').value = item.color || '#2E6F40';
  } else {
    $('#entityName').value = '';
    $('#entityColor').value = type === 'folder' ? '#2E6F40' : '#64748b';
  }
  $('#entityModal').classList.add('open');
  $('#entityName').focus();
}

function closeEntityModal() {
  $('#entityModal').classList.remove('open');
}

async function saveEntity() {
  const type = $('#entityType').value;
  const id = $('#entityId').value;
  const name = $('#entityName').value.trim();
  const color = $('#entityColor').value;
  if (!name) {
    showToast('Name is required', 'error');
    return;
  }
  try {
    if (type === 'folder') {
      if (id) await Storage.updateFolder(id, { name, color });
      else await Storage.addFolder(name, color);
    } else {
      if (id) await Storage.updateTag(id, { name, color });
      else await Storage.addTag(name, color);
    }
    showToast(id ? 'Updated' : 'Created');
    closeEntityModal();
    await loadAll();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ---------- Settings ----------
async function loadSettingsUI() {
  const s = await Storage.getSettings();
  $('#settingTrigger').value = s.expansionTrigger || 'space';
  $('#settingTheme').value = s.theme || 'light';
  $('#settingFormFill').checked = s.enableFormFill !== false;
  $('#settingSync').checked = s.syncEnabled !== false;
}

async function saveSettings() {
  const settings = await Storage.getSettings();
  settings.expansionTrigger = $('#settingTrigger').value;
  settings.theme = $('#settingTheme').value;
  settings.enableFormFill = $('#settingFormFill').checked;
  settings.syncEnabled = $('#settingSync').checked;
  await Storage.saveSettings(settings);
  document.documentElement.setAttribute('data-theme', settings.theme);
  updateThemeIcon(settings.theme);
  // Trigger a sync if just enabled
  if (settings.syncEnabled) {
    await Storage._maybeSync();
  }
  showToast('Settings saved');
}

// ---------- Backup ----------
async function doExport() {
  const data = await Storage.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `textflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
}

async function doImport(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const count = await Storage.importData(data);
    await loadAll();
    showToast(`Imported ${count} snippets`);
  } catch (e) {
    showToast('Import failed: ' + e.message, 'error');
  }
}


function clearAllFilters() {
  currentFolderFilter = 'all';
  activeTagFilters.clear();
  currentSort = 'updated-desc';
  if ($('#optSearch')) $('#optSearch').value = '';
  if ($('#optFolderFilter')) $('#optFolderFilter').value = 'all';
  if ($('#optSort')) $('#optSort').value = 'updated-desc';
  renderTagFilters();
  renderTable();
  showToast('Filters cleared');
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  setupNav();
  await loadAll();
  await loadSettingsUI();

  $('#themeToggle').addEventListener('click', toggleTheme);

  // Snippets
  $('#optSearch').addEventListener('input', renderTable);
  $('#optSort').addEventListener('change', (e) => { currentSort = e.target.value; renderTable(); });
  $('#optFolderFilter').addEventListener('change', (e) => { currentFolderFilter = e.target.value; renderTable(); });
  $('#optClearFilters')?.addEventListener('click', clearAllFilters);
  $('#optTagFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.tag-chip');
    if (!chip) return;
    const tag = chip.dataset.tag;
    if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
    else activeTagFilters.add(tag);
    renderTagFilters();
    renderTable();
  });
  $('#optAddBtn').addEventListener('click', () => openSnippetModal());
  $('#optTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    if (btn.dataset.action === 'edit') openSnippetModal(id);
    if (btn.dataset.action === 'delete') deleteSnippet(id);
  });

  // Snippet modal
  $('#optCloseModal').addEventListener('click', closeSnippetModal);
  $('#optCancel').addEventListener('click', closeSnippetModal);
  $('#optModal').addEventListener('click', (e) => { if (e.target === $('#optModal')) closeSnippetModal(); });
  $('#optSave').addEventListener('click', saveSnippet);
  $('#optDelete').addEventListener('click', () => { const id = $('#optEditId').value; if (id) deleteSnippet(id); });

  // Folders
  $('#addFolderBtn').addEventListener('click', async () => {
    const name = $('#newFolderName').value.trim();
    const color = $('#newFolderColor').value;
    if (!name) { showToast('Folder name required', 'error'); return; }
    await Storage.addFolder(name, color);
    $('#newFolderName').value = '';
    await loadAll();
    showToast('Folder created');
  });
  $('#foldersList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('.entity-card').dataset.id;
    if (btn.dataset.action === 'edit-folder') openEntityModal('folder', id);
    if (btn.dataset.action === 'delete-folder') {
      if (confirm('Delete folder? Snippets will become uncategorized.')) {
        await Storage.deleteFolder(id);
        await loadAll();
        showToast('Folder deleted');
      }
    }
  });

  // Tags
  $('#addTagBtn').addEventListener('click', async () => {
    const name = $('#newTagName').value.trim();
    const color = $('#newTagColor').value;
    if (!name) { showToast('Tag name required', 'error'); return; }
    try {
      await Storage.addTag(name, color);
      $('#newTagName').value = '';
      await loadAll();
      showToast('Tag created');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
  $('#tagsList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('.entity-card').dataset.id;
    if (btn.dataset.action === 'edit-tag') openEntityModal('tag', id);
    if (btn.dataset.action === 'delete-tag') {
      if (confirm('Delete tag? It will be removed from all snippets.')) {
        await Storage.deleteTag(id);
        await loadAll();
        showToast('Tag deleted');
      }
    }
  });

  // Entity modal
  $('#entityClose').addEventListener('click', closeEntityModal);
  $('#entityCancel').addEventListener('click', closeEntityModal);
  $('#entityModal').addEventListener('click', (e) => { if (e.target === $('#entityModal')) closeEntityModal(); });
  $('#entitySave').addEventListener('click', saveEntity);

  // Settings
  $('#saveSettings').addEventListener('click', saveSettings);

  // Backup
  $('#optExport').addEventListener('click', doExport);
  $('#optImport').addEventListener('click', () => $('#optImportFile').click());
  $('#optImportFile').addEventListener('change', (e) => {
    if (e.target.files[0]) doImport(e.target.files[0]);
    e.target.value = '';
  });
});
