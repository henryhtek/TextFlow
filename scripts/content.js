/**
 * Content script – listens for shortcut expansion in inputs/textareas/contenteditable
 * and provides basic form auto-fill using placeholders / common field detection.
 */

(function () {
  'use strict';

  let snippets = [];
  let settings = {
    expansionTrigger: 'space',
    enableFormFill: true,
    triggerPrefix: ';'
  };
  let buffer = '';
  let lastKeyTime = 0;

  // Load data
  async function refreshData() {
    try {
      const result = await chrome.storage.local.get(['snippets', 'settings']);
      snippets = result.snippets || [];
      if (result.settings) {
        settings = { ...settings, ...result.settings };
      }
    } catch (e) {
      // Extension context invalidated etc.
    }
  }

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.snippets) snippets = changes.snippets.newValue || [];
    if (changes.settings) settings = { ...settings, ...changes.settings.newValue };
  });

  // Process placeholders in expansion text
  function processPlaceholders(text) {
    const now = new Date();
    return text
      .replace(/\{\{date\}\}/gi, now.toLocaleDateString())
      .replace(/\{\{time\}\}/gi, now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      .replace(/\{\{datetime\}\}/gi, now.toLocaleString())
      .replace(/\{\{year\}\}/gi, String(now.getFullYear()))
      .replace(/\{\{clipboard\}\}/gi, () => {
        // Clipboard is async; we approximate by leaving placeholder if not available
        return '[clipboard]';
      });
  }

  // Find matching snippet by current buffer
  function findMatch(text) {
    // Prefer longer matches
    const candidates = snippets
      .filter(s => text.endsWith(s.shortcut))
      .sort((a, b) => b.shortcut.length - a.shortcut.length);
    return candidates[0] || null;
  }

  // Expand in a standard input / textarea
  function expandInInput(el, match) {
    const start = el.selectionStart;
    const value = el.value;
    const before = value.slice(0, start);
    const after = value.slice(start);

    if (!before.endsWith(match.shortcut)) return false;

    const expansion = processPlaceholders(match.expansion);
    const newBefore = before.slice(0, -match.shortcut.length) + expansion;
    el.value = newBefore + after;
    const newPos = newBefore.length;
    el.setSelectionRange(newPos, newPos);

    // Trigger input event for frameworks
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    // Track usage
    chrome.runtime.sendMessage({ type: 'incrementUsage', id: match.id }).catch(() => {});

    return true;
  }

  // Expand in contenteditable
  function expandInContentEditable(el, match) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return false;

    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    // Get text before caret
    const preRange = range.cloneRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.endContainer, range.endOffset);
    const textBefore = preRange.toString();

    if (!textBefore.endsWith(match.shortcut)) return false;

    // Delete the shortcut characters
    for (let i = 0; i < match.shortcut.length; i++) {
      document.execCommand('delete');
    }

    const expansion = processPlaceholders(match.expansion);
    document.execCommand('insertText', false, expansion);

    chrome.runtime.sendMessage({ type: 'incrementUsage', id: match.id }).catch(() => {});
    return true;
  }

  // Main key handler
  function onKeyDown(e) {
    const el = e.target;
    if (!el || !(el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=submit]):not([type=button]):not([type=reset]), textarea') || el.isContentEditable)) {
      return;
    }

    // Trigger on space / enter / tab depending on settings
    const isTrigger =
      (settings.expansionTrigger === 'space' && e.key === ' ') ||
      (settings.expansionTrigger === 'enter' && e.key === 'Enter') ||
      (settings.expansionTrigger === 'tab' && e.key === 'Tab');

    if (!isTrigger) return;

    let textBefore = '';
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const preRange = range.cloneRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.endContainer, range.endOffset);
      textBefore = preRange.toString();
    } else {
      textBefore = el.value.slice(0, el.selectionStart);
    }

    const match = findMatch(textBefore);
    if (!match) return;

    // Prevent the trigger key from being inserted when we expand
    e.preventDefault();
    e.stopPropagation();

    if (el.isContentEditable) {
      expandInContentEditable(el, match);
    } else {
      expandInInput(el, match);
    }
  }

  // Also support real-time expansion when the shortcut is fully typed (no extra trigger)
  // by checking on input for exact match ending with the shortcut
  function onInput(e) {
    const el = e.target;
    if (!el || el.isContentEditable) return; // contenteditable handled only on trigger for simplicity

    if (!['INPUT', 'TEXTAREA'].includes(el.tagName)) return;

    const start = el.selectionStart;
    const textBefore = el.value.slice(0, start);
    const match = findMatch(textBefore);

    // Only auto-expand if the last character typed completed the shortcut
    // and the user is not in the middle of a longer word (simple heuristic)
    if (match && textBefore.endsWith(match.shortcut)) {
      // Optional: require a non-word char before the shortcut or start of field
      const beforeShortcut = textBefore.slice(0, -match.shortcut.length);
      const lastChar = beforeShortcut.slice(-1);
      if (beforeShortcut === '' || /[\s\n\t.,;:!?]/.test(lastChar)) {
        // We expand on the next space by default; here we do immediate for convenience
        // Comment out if you prefer only trigger-key expansion
        // expandInInput(el, match);
      }
    }
  }

  // ----- Form auto-populate helpers -----

  function detectFieldType(el) {
    const name = (el.name || el.id || el.placeholder || el.getAttribute('aria-label') || '').toLowerCase();
    const type = (el.type || '').toLowerCase();
    const autocomplete = (el.autocomplete || '').toLowerCase();

    if (type === 'email' || name.includes('email') || autocomplete.includes('email')) return 'email';
    if (name.includes('phone') || name.includes('tel') || type === 'tel' || autocomplete.includes('tel')) return 'phone';
    if (name.includes('first') && name.includes('name') || autocomplete === 'given-name') return 'firstName';
    if (name.includes('last') && name.includes('name') || autocomplete === 'family-name') return 'lastName';
    if (name.includes('fullname') || name.includes('full-name') || name === 'name' || autocomplete === 'name') return 'fullName';
    if (name.includes('address') || autocomplete.includes('address')) return 'address';
    if (name.includes('city') || autocomplete === 'address-level2') return 'city';
    if (name.includes('zip') || name.includes('postal') || autocomplete === 'postal-code') return 'zip';
    if (name.includes('company') || name.includes('organization')) return 'company';
    if (name.includes('title') || name.includes('job')) return 'jobTitle';
    return null;
  }

  // Simple profile stored in settings or a special snippet set
  // For now we look for snippets tagged "profile" or specific shortcuts
  function getProfileValue(fieldType) {
    const map = {
      email: [';email', 'mail'],
      phone: [';phone', 'tel', 'mobile'],
      firstName: [';firstname', 'fname', 'first'],
      lastName: [';lastname', 'lname', 'last'],
      fullName: [';fullname', 'name', 'myname'],
      address: [';address', 'street'],
      city: [';city'],
      zip: [';zip', 'postal'],
      company: [';company', 'org'],
      jobTitle: [';title', 'jobtitle', 'role']
    };
    const candidates = map[fieldType] || [];
    for (const c of candidates) {
      const s = snippets.find(x => x.shortcut.toLowerCase() === c || (x.tags || []).includes(c));
      if (s) return processPlaceholders(s.expansion);
    }
    return null;
  }

  // Expose a simple fill for the current form
  function fillCurrentForm() {
    if (!settings.enableFormFill) return 0;
    const form = document.activeElement?.closest('form') || document.querySelector('form');
    if (!form) return 0;

    let filled = 0;
    const fields = form.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select');
    fields.forEach(el => {
      if (el.value && el.value.trim()) return; // don't overwrite
      const type = detectFieldType(el);
      if (!type) return;
      const value = getProfileValue(type);
      if (value) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    });
    return filled;
  }

  // Listen for messages from popup / background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'fillForm') {
      const count = fillCurrentForm();
      sendResponse({ filled: count });
    } else if (msg.type === 'getPageInfo') {
      sendResponse({
        url: location.href,
        title: document.title,
        hasForm: !!document.querySelector('form')
      });
    }
    return true;
  });

  // Init
  refreshData();
  document.addEventListener('keydown', onKeyDown, true);
  // document.addEventListener('input', onInput, true);

  // Keyboard shortcut for form fill: Ctrl+Shift+F (optional)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      const count = fillCurrentForm();
      if (count > 0) {
        // Visual feedback could be added
        console.log(`[TextFlow] Filled ${count} fields`);
      }
    }
  }, true);
})();
