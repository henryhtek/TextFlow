/**
 * Storage helper for TextFlow
 * Handles chrome.storage.local + optional sync, folders, tags, export/import
 */

const Storage = {
  SNIPPETS_KEY: 'snippets',
  FOLDERS_KEY: 'folders',
  TAGS_KEY: 'tags',
  SETTINGS_KEY: 'settings',

  // ---------- Settings ----------
  async getSettings() {
    const result = await chrome.storage.local.get(this.SETTINGS_KEY);
    return {
      theme: 'light',
      expansionTrigger: 'space',
      enableFormFill: true,
      triggerPrefix: ';',
      syncEnabled: true,
      ...(result[this.SETTINGS_KEY] || {})
    };
  },

  async saveSettings(settings) {
    await chrome.storage.local.set({ [this.SETTINGS_KEY]: settings });
  },

  // ---------- Folders ----------
  async getFolders() {
    const result = await chrome.storage.local.get(this.FOLDERS_KEY);
    return result[this.FOLDERS_KEY] || [];
  },

  async saveFolders(folders) {
    await chrome.storage.local.set({ [this.FOLDERS_KEY]: folders });
    await this._maybeSync();
  },

  async addFolder(name, color = '#2E6F40') {
    const folders = await this.getFolders();
    const folder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      created: Date.now()
    };
    folders.push(folder);
    await this.saveFolders(folders);
    return folder;
  },

  async updateFolder(id, updates) {
    const folders = await this.getFolders();
    const idx = folders.findIndex(f => f.id === id);
    if (idx === -1) return null;
    folders[idx] = { ...folders[idx], ...updates, name: (updates.name || folders[idx].name).trim() };
    await this.saveFolders(folders);
    return folders[idx];
  },

  async deleteFolder(id) {
    let folders = await this.getFolders();
    folders = folders.filter(f => f.id !== id);
    // Move snippets in this folder to uncategorized
    const snippets = await this.getSnippets();
    snippets.forEach(s => {
      if (s.folderId === id) s.folderId = null;
    });
    await this.saveSnippets(snippets);
    await this.saveFolders(folders);
    return true;
  },

  // ---------- Tags (global tag library) ----------
  async getTags() {
    const result = await chrome.storage.local.get(this.TAGS_KEY);
    return result[this.TAGS_KEY] || [];
  },

  async saveTags(tags) {
    await chrome.storage.local.set({ [this.TAGS_KEY]: tags });
    await this._maybeSync();
  },

  async addTag(name, color = '#64748b') {
    const tags = await this.getTags();
    const normalized = name.trim().toLowerCase();
    if (tags.some(t => t.name === normalized)) {
      throw new Error('Tag already exists');
    }
    const tag = {
      id: crypto.randomUUID(),
      name: normalized,
      color,
      created: Date.now()
    };
    tags.push(tag);
    await this.saveTags(tags);
    return tag;
  },

  async updateTag(id, updates) {
    const tags = await this.getTags();
    const idx = tags.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const newName = (updates.name || tags[idx].name).trim().toLowerCase();
    if (tags.some(t => t.name === newName && t.id !== id)) {
      throw new Error('Tag name already exists');
    }
    const oldName = tags[idx].name;
    tags[idx] = { ...tags[idx], ...updates, name: newName };
    // Propagate rename to snippets
    if (oldName !== newName) {
      const snippets = await this.getSnippets();
      snippets.forEach(s => {
        if (s.tags && s.tags.includes(oldName)) {
          s.tags = s.tags.map(t => t === oldName ? newName : t);
        }
      });
      await this.saveSnippets(snippets);
    }
    await this.saveTags(tags);
    return tags[idx];
  },

  async deleteTag(id) {
    const tags = await this.getTags();
    const tag = tags.find(t => t.id === id);
    if (!tag) return false;
    const remaining = tags.filter(t => t.id !== id);
    // Remove tag from all snippets
    const snippets = await this.getSnippets();
    snippets.forEach(s => {
      if (s.tags) s.tags = s.tags.filter(t => t !== tag.name);
    });
    await this.saveSnippets(snippets);
    await this.saveTags(remaining);
    return true;
  },

  // ---------- Snippets ----------
  async getSnippets() {
    const result = await chrome.storage.local.get(this.SNIPPETS_KEY);
    return result[this.SNIPPETS_KEY] || [];
  },

  async saveSnippets(snippets) {
    await chrome.storage.local.set({ [this.SNIPPETS_KEY]: snippets });
    await this._maybeSync();
  },

  async addSnippet(snippet) {
    const snippets = await this.getSnippets();
    const newSnippet = {
      id: crypto.randomUUID(),
      shortcut: snippet.shortcut.trim(),
      expansion: snippet.expansion,
      tags: (snippet.tags || []).map(t => t.trim().toLowerCase()).filter(Boolean),
      folderId: snippet.folderId || null,
      usageCount: 0,
      created: Date.now(),
      updated: Date.now()
    };
    snippets.unshift(newSnippet);
    // Ensure tags exist in global library
    await this._ensureTags(newSnippet.tags);
    await this.saveSnippets(snippets);
    return newSnippet;
  },

  async updateSnippet(id, updates) {
    const snippets = await this.getSnippets();
    const idx = snippets.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const tags = updates.tags
      ? updates.tags.map(t => t.trim().toLowerCase()).filter(Boolean)
      : snippets[idx].tags;
    snippets[idx] = {
      ...snippets[idx],
      ...updates,
      shortcut: updates.shortcut?.trim() ?? snippets[idx].shortcut,
      tags,
      folderId: updates.folderId !== undefined ? updates.folderId : snippets[idx].folderId,
      updated: Date.now()
    };
    await this._ensureTags(tags);
    await this.saveSnippets(snippets);
    return snippets[idx];
  },

  async deleteSnippet(id) {
    let snippets = await this.getSnippets();
    snippets = snippets.filter(s => s.id !== id);
    await this.saveSnippets(snippets);
    return true;
  },

  async incrementUsage(id) {
    const snippets = await this.getSnippets();
    const s = snippets.find(x => x.id === id);
    if (s) {
      s.usageCount = (s.usageCount || 0) + 1;
      s.updated = Date.now();
      await this.saveSnippets(snippets);
    }
  },

  // ---------- Sync helper ----------
  async _maybeSync() {
    const settings = await this.getSettings();
    if (!settings.syncEnabled) return;
    try {
      const snippets = await this.getSnippets();
      const folders = await this.getFolders();
      const tags = await this.getTags();
      // Keep payload small for sync quota
      const syncPayload = {
        snippets: snippets.map(s => ({
          id: s.id,
          shortcut: s.shortcut,
          expansion: s.expansion,
          tags: s.tags || [],
          folderId: s.folderId || null,
          usageCount: s.usageCount || 0,
          updated: s.updated
        })),
        folders,
        tags
      };
      await chrome.storage.sync.set({ textflow_data: syncPayload });
    } catch (e) {
      console.warn('Sync failed:', e.message);
    }
  },

  async restoreFromSync() {
    try {
      const result = await chrome.storage.sync.get('textflow_data');
      const data = result.textflow_data;
      if (!data) return 0;
      const localSnippets = await this.getSnippets();
      if (localSnippets.length > 0) return 0; // don't overwrite
      if (data.snippets) await chrome.storage.local.set({ [this.SNIPPETS_KEY]: data.snippets });
      if (data.folders) await chrome.storage.local.set({ [this.FOLDERS_KEY]: data.folders });
      if (data.tags) await chrome.storage.local.set({ [this.TAGS_KEY]: data.tags });
      return (data.snippets || []).length;
    } catch (e) {
      console.warn('Restore from sync failed', e);
      return 0;
    }
  },

  async _ensureTags(tagNames) {
    if (!tagNames || !tagNames.length) return;
    const existing = await this.getTags();
    const existingNames = new Set(existing.map(t => t.name));
    let changed = false;
    for (const name of tagNames) {
      if (!existingNames.has(name)) {
        existing.push({
          id: crypto.randomUUID(),
          name,
          color: '#64748b',
          created: Date.now()
        });
        existingNames.add(name);
        changed = true;
      }
    }
    if (changed) await this.saveTags(existing);
  },

  // ---------- Export / Import ----------
  async exportData() {
    const [snippets, folders, tags, settings] = await Promise.all([
      this.getSnippets(),
      this.getFolders(),
      this.getTags(),
      this.getSettings()
    ]);
    return {
      version: 2,
      app: 'TextFlow',
      exportedAt: new Date().toISOString(),
      snippets,
      folders,
      tags,
      settings
    };
  },

  async importData(data) {
    if (!data || !Array.isArray(data.snippets)) {
      throw new Error('Invalid backup file');
    }
    const snippets = data.snippets.map(s => ({
      id: s.id || crypto.randomUUID(),
      shortcut: s.shortcut,
      expansion: s.expansion,
      tags: s.tags || [],
      folderId: s.folderId || null,
      usageCount: s.usageCount || 0,
      created: s.created || Date.now(),
      updated: s.updated || Date.now()
    }));
    await chrome.storage.local.set({ [this.SNIPPETS_KEY]: snippets });
    if (Array.isArray(data.folders)) {
      await chrome.storage.local.set({ [this.FOLDERS_KEY]: data.folders });
    }
    if (Array.isArray(data.tags)) {
      await chrome.storage.local.set({ [this.TAGS_KEY]: data.tags });
    } else {
      // Rebuild tags from snippets
      const tagSet = new Set();
      snippets.forEach(s => (s.tags || []).forEach(t => tagSet.add(t)));
      const tags = [...tagSet].map(name => ({
        id: crypto.randomUUID(),
        name,
        color: '#64748b',
        created: Date.now()
      }));
      await chrome.storage.local.set({ [this.TAGS_KEY]: tags });
    }
    if (data.settings) {
      await this.saveSettings({ ...(await this.getSettings()), ...data.settings });
    }
    await this._maybeSync();
    return snippets.length;
  }
};
