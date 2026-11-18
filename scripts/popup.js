/**
 * Popup UI logic for TextFlow
 */

let snippets = [];
let folders = [];
let tags = [];
let currentFolder = 'all';
let activeTagFilters = new Set(); // multi-select tags
let currentSort = 'updated-desc';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const ICONS = {
  sun: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  edit: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>`,
  copy: `<svg class="icon icon-sm" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`,
  empty: `<svg class="icon" viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`
};

function showToast(msg, type = 'success') {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

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
    if (query) items = available.filter(t => t.name.includes(query));
    const exactExists = all.some(t => t.name === query) || selected.includes(query);
    let html = items.slice(0, 8).map((t, i) =>
      `<div class="tag-suggestion${i === activeIdx ? ' active' : ''}" data-tag="${escapeHtml(t.name)}">
        <span class="suggest-dot" style="background:${t.color || 'var(--accent)'}"></span>
        ${escapeHtml(t.name)}
      </div>`
    ).join('');
    if (query && !exactExists) {
      html += `<div class="tag-suggestion${activeIdx === items.length ? ' active' : ''}" data-create="${escapeHtml(query)}">
        <span class="suggest-create">+ Create “${escapeHtml(query)}”</span>
      </div>`;
    }
    if (!html) { hideSuggestions(); return; }
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
    e.preventDefault();
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
  const settings = await Storage.getSettings();
  document.documentElement.setAttribute('data-theme', settings.theme || 'light');
  updateThemeIcon(settings.theme || 'light');
}

function updateThemeIcon(theme) {
  const btn = $('#themeToggle');
  if (btn) btn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
}

async function toggleTheme() {
  const settings = await Storage.getSettings();
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  await Storage.saveSettings(settings);
  document.documentElement.setAttribute('data-theme', settings.theme);
  updateThemeIcon(settings.theme);
}

async function loadAll() {
  [snippets, folders, tags] = await Promise.all([
    Storage.getSnippets(),
    Storage.getFolders(),
    Storage.getTags()
  ]);
  if (snippets.length === 0) {
    const restored = await Storage.restoreFromSync();
    if (restored > 0) {
      snippets = await Storage.getSnippets();
      folders = await Storage.getFolders();
      tags = await Storage.getTags();
      showToast(`Restored ${restored} snippets from sync`);
    }
  }
  populateFolderSelects();
  renderTagFilters();
  renderList();
}

function populateFolderSelects() {
  const opts = `<option value="">Uncategorized</option>` +
    folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
  const filterOpts = `<option value="all">All folders</option><option value="">Uncategorized</option>` +
    folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');

  $('#newFolder').innerHTML = opts;
  $('#editFolder').innerHTML = opts;
  $('#folderFilter').innerHTML = filterOpts;
  $('#folderFilter').value = currentFolder;
}

function renderTagFilters() {
  const container = $('#tagFilters');
  if (!tags.length) {
    container.innerHTML = `<span class="text-sm text-muted">No tags yet</span>`;
    return;
  }
  container.innerHTML = tags.map(t => {
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
  const q = ($('#searchInput')?.value || '').trim().toLowerCase();

  if (q) {
    list = list.filter(s =>
      s.shortcut.toLowerCase().includes(q) ||
      s.expansion.toLowerCase().includes(q) ||
      (s.tags || []).some(t => t.includes(q))
    );
  }

  // Folder filter
  if (currentFolder === '') {
    list = list.filter(s => !s.folderId);
  } else if (currentFolder !== 'all') {
    list = list.filter(s => s.folderId === currentFolder);
  }

  // Tag filters (AND logic if multiple)
  if (activeTagFilters.size > 0) {
    list = list.filter(s => {
      const stags = s.tags || [];
      return [...activeTagFilters].every(t => stags.includes(t));
    });
  }

  // Sort
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

function getFolderName(folderId) {
  if (!folderId) return null;
  const f = folders.find(x => x.id === folderId);
  return f ? f : null;
}

function renderList() {
  const list = getFilteredSorted();
  $('#stats').textContent = `${snippets.length} snippet${snippets.length !== 1 ? 's' : ''}`;

  if (list.length === 0) {
    $('#snippetList').innerHTML = `
      <div class="empty-state">
        ${ICONS.empty}
        <h3>No snippets found</h3>
        <p>Try a different filter or add a new snippet.</p>
      </div>`;
    return;
  }

  $('#snippetList').innerHTML = list.map(s => {
    const folder = getFolderName(s.folderId);
    const folderHtml = folder
      ? `<span class="folder-badge"><span class="folder-dot" style="background:${folder.color}"></span>${escapeHtml(folder.name)}</span>`
      : '';
    return `
    <div class="snippet-item" data-id="${s.id}">
      <span class="snippet-shortcut" title="${escapeHtml(s.shortcut)}">${escapeHtml(s.shortcut)}</span>
      <div class="snippet-body">
        <div class="snippet-expansion">${escapeHtml(s.expansion)}</div>
        <div class="snippet-meta">
          ${folderHtml}
          ${(s.tags || []).map(t => {
            const meta = tags.find(x => x.name === t);
            const color = meta?.color || '#2E6F40';
            return `<span class="badge" style="background:${color}22;color:${color}">${escapeHtml(t)}</span>`;
          }).join('')}
          ${s.usageCount ? `<span>${s.usageCount} uses</span>` : ''}
        </div>
      </div>
      <div class="snippet-actions">
        <button class="btn-icon btn-ghost" data-action="copy" title="Copy">${ICONS.copy}</button>
        <button class="btn-icon btn-ghost" data-action="edit" title="Edit">${ICONS.edit}</button>
      </div>
    </div>`;
  }).join('');
}


function clearAllFilters() {
  currentFolder = 'all';
  activeTagFilters.clear();
  currentSort = 'updated-desc';
  if ($('#searchInput')) $('#searchInput').value = '';
  if ($('#folderFilter')) $('#folderFilter').value = 'all';
  if ($('#sortSelect')) $('#sortSelect').value = 'updated-desc';
  renderTagFilters();
  renderList();
  showToast('Filters cleared');
}

function setupEvents() {
  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

  $('#searchInput').addEventListener('input', renderList);

  $('#folderFilter').addEventListener('change', (e) => {
    currentFolder = e.target.value;
    renderList();
  });

  $('#clearFilters')?.addEventListener('click', clearAllFilters);

  $('#sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderList();
  });

  // Tag chips (multi-select)
  $('#tagFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.tag-chip');
    if (!chip) return;
    const tag = chip.dataset.tag;
    if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
    else activeTagFilters.add(tag);
    renderTagFilters();
    renderList();
  });

  // Quick add
  $('#toggleAdd').addEventListener('click', () => {
    $('#quickAdd').classList.toggle('open');
    if ($('#quickAdd').classList.contains('open')) $('#newShortcut').focus();
  });
  $('#cancelAdd').addEventListener('click', () => {
    $('#quickAdd').classList.remove('open');
    clearAddForm();
  });
  $('#saveAdd').addEventListener('click', async () => {
    const shortcut = $('#newShortcut').value.trim();
    const expansion = $('#newExpansion').value;
    const folderId = $('#newFolder').value || null;
    const tagsList = newTagPicker ? newTagPicker.getSelected() : [];
    if (!shortcut || !expansion) {
      showToast('Shortcut and expansion required', 'error');
      return;
    }
    if (snippets.some(s => s.shortcut === shortcut)) {
      showToast('Shortcut already exists', 'error');
      return;
    }
    await Storage.addSnippet({ shortcut, expansion, tags: tagsList, folderId });
    clearAddForm();
    $('#quickAdd').classList.remove('open');
    await loadAll();
    showToast('Snippet added');
  });

  // List actions
  $('#snippetList').addEventListener('click', async (e) => {
    const item = e.target.closest('.snippet-item');
    if (!item) return;
    const id = item.dataset.id;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'copy') {
      const s = snippets.find(x => x.id === id);
      if (s) {
        await navigator.clipboard.writeText(s.expansion);
        showToast('Copied');
      }
    } else {
      openEditModal(id);
    }
  });

  // Modal
  $('#closeModal').addEventListener('click', closeEditModal);
  $('#cancelEdit').addEventListener('click', closeEditModal);
  $('#editModal').addEventListener('click', (e) => {
    if (e.target === $('#editModal')) closeEditModal();
  });
  $('#saveEdit').addEventListener('click', async () => {
    const id = $('#editId').value;
    const shortcut = $('#editShortcut').value.trim();
    const expansion = $('#editExpansion').value;
    const folderId = $('#editFolder').value || null;
    const tagsList = editTagPicker ? editTagPicker.getSelected() : [];
    if (!shortcut || !expansion) {
      showToast('Shortcut and expansion required', 'error');
      return;
    }
    if (snippets.some(s => s.shortcut === shortcut && s.id !== id)) {
      showToast('Shortcut already exists', 'error');
      return;
    }
    await Storage.updateSnippet(id, { shortcut, expansion, tags: tagsList, folderId });
    closeEditModal();
    await loadAll();
    showToast('Snippet updated');
  });
  $('#deleteSnippet').addEventListener('click', async () => {
    if (confirm('Delete this snippet?')) {
      await Storage.deleteSnippet($('#editId').value);
      closeEditModal();
      await loadAll();
      showToast('Deleted');
    }
  });

  // Export / Import
  $('#exportBtn').addEventListener('click', async () => {
    const data = await Storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported');
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await Storage.importData(data);
      await loadAll();
      showToast(`Imported ${count} snippets`);
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
    e.target.value = '';
  });
}

function clearAddForm() {
  $('#newShortcut').value = '';
  $('#newExpansion').value = '';
  $('#newFolder').value = '';
  if (newTagPicker) newTagPicker.setSelected([]);
}

function openEditModal(id) {
  const s = snippets.find(x => x.id === id);
  if (!s) return;
  $('#editId').value = id;
  $('#editShortcut').value = s.shortcut;
  $('#editExpansion').value = s.expansion;
  $('#editFolder').value = s.folderId || '';
  if (editTagPicker) editTagPicker.setSelected(s.tags || []);
  $('#modalTitle').textContent = 'Edit Snippet';
  $('#editModal').classList.add('open');
}

function closeEditModal() {
  $('#editModal').classList.remove('open');
}

let newTagPicker = null;
let editTagPicker = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  setupEvents();
  await loadAll();
  newTagPicker = createTagPicker({
    selectedEl: $('#newTagSelected'),
    fieldEl: $('#newTagField'),
    suggestionsEl: $('#newTagSuggestions'),
    getAllTags: () => tags
  });
  editTagPicker = createTagPicker({
    selectedEl: $('#editTagSelected'),
    fieldEl: $('#editTagField'),
    suggestionsEl: $('#editTagSuggestions'),
    getAllTags: () => tags
  });
});
