/**
 * Service worker for TextFlow
 */

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const now = Date.now();
    const defaultFolderId = crypto.randomUUID();

    const folders = [
      { id: defaultFolderId, name: 'General', color: '#2E6F40', created: now },
      { id: crypto.randomUUID(), name: 'Work', color: '#3D8B55', created: now },
      { id: crypto.randomUUID(), name: 'Personal', color: '#6BBF7A', created: now }
    ];

    const tags = [
      { id: crypto.randomUUID(), name: 'greeting', color: '#8B5CF6', created: now },
      { id: crypto.randomUUID(), name: 'signature', color: '#F59E0B', created: now },
      { id: crypto.randomUUID(), name: 'utility', color: '#64748B', created: now },
      { id: crypto.randomUUID(), name: 'profile', color: '#EC4899', created: now },
      { id: crypto.randomUUID(), name: 'email', color: '#3B82F6', created: now }
    ];

    const snippets = [
      {
        id: crypto.randomUUID(),
        shortcut: ';hello',
        expansion: 'Hello! How can I help you today?',
        tags: ['greeting'],
        folderId: defaultFolderId,
        usageCount: 0,
        created: now,
        updated: now
      },
      {
        id: crypto.randomUUID(),
        shortcut: ';sig',
        expansion: 'Best regards,\n{{name}}',
        tags: ['signature'],
        folderId: defaultFolderId,
        usageCount: 0,
        created: now,
        updated: now
      },
      {
        id: crypto.randomUUID(),
        shortcut: ';date',
        expansion: '{{date}}',
        tags: ['utility'],
        folderId: defaultFolderId,
        usageCount: 0,
        created: now,
        updated: now
      },
      {
        id: crypto.randomUUID(),
        shortcut: ';email',
        expansion: 'you@example.com',
        tags: ['profile', 'email'],
        folderId: defaultFolderId,
        usageCount: 0,
        created: now,
        updated: now
      }
    ];

    await chrome.storage.local.set({
      snippets,
      folders,
      tags,
      settings: {
        theme: 'light',
        expansionTrigger: 'space',
        enableFormFill: true,
        triggerPrefix: ';',
        syncEnabled: true
      }
    });
  }
});

// Handle messages from content / popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'incrementUsage') {
    (async () => {
      const result = await chrome.storage.local.get('snippets');
      const snippets = result.snippets || [];
      const s = snippets.find(x => x.id === msg.id);
      if (s) {
        s.usageCount = (s.usageCount || 0) + 1;
        s.updated = Date.now();
        await chrome.storage.local.set({ snippets });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-popup') {
    // Handled by browser
  }
});
