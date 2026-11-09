import { vaultDB } from './db/vaultDB.js';
import { t } from './i18n/translations.js';
import { compareActiveListDeals } from './services/dealsEngine.js';
import {
  SAMPLE_DEMO_CARDS,
  renderDemoCardToDataUrl,
  runImageOCR,
  extractStructuredContactFromText,
  downloadVCard
} from './services/ocrScanner.js';
import {
  syncWithGoogleDrive,
  syncWithICloudDrive,
  restoreFromCloudSnapshot,
  downloadFullBackupFile,
  decryptVaultPayload
} from './services/cloudSync.js';

const UNITS = ['kg', 'gm', 'L', 'ml', 'pcs', 'packet', 'pair', 'set', 'kit', 'box', 'strings', 'units'];

const uiState = {
  activeTab: 'lists', // 'lists' | 'notes' | 'cards' | 'offers' | 'sync'
  listsSubView: 'active', // 'active' | 'master' | 'wizard' | 'execute' | 'masterDetail'
  selectedMasterId: 'ml-indian-grocery',
  selectedActiveId: 'al-nov-grocery',
  offersListId: 'al-nov-grocery',

  // Wizard state for generating Active List from Master List
  wizardMasterId: null,
  wizardListTitle: '',
  wizardSelections: {}, // { [masterItemId]: { selected: true, qty, unit, estimatedPrice, name, category, brand } }
  wizardCustomItems: [], // [{ name, category, qty, unit, brand, estimatedPrice, saveToMaster }]

  // Global search filter
  searchQuery: '',

  // Notes editor state
  editingNote: null,
  isRecordingVoice: false,
  noteTagFilter: 'ALL',

  // Card Scanner state
  showCardScannerPanel: false,
  ocrProgress: 0,
  ocrStatusText: '',
  cardFilterCategory: 'ALL',
  cameraStream: null,
  cardDraft: {
    id: '',
    fullName: '',
    designation: '',
    company: '',
    phone: '',
    altPhone: '',
    email: '',
    website: '',
    address: '',
    category: 'Vendor',
    tagsText: 'Supplier, Verified',
    notes: '',
    frontImage: '',
    rawOcrText: ''
  },

  // Master List creator toggle
  showNewMasterModal: false
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatINR(num) {
  const n = Number(num) || 0;
  return '₹' + n.toLocaleString('en-IN');
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast-banner';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3400);
}

// Initialize Wizard State from a Master List Blueprint
function openWizardForMasterList(masterId) {
  const ml = vaultDB.state.masterLists.find((m) => m.id === masterId);
  if (!ml) return;

  const monthName = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const baseTitle = ml.title.split('(')[0].replace(/Master List|Blueprint/gi, '').trim();
  uiState.wizardMasterId = ml.id;
  uiState.wizardListTitle = `${monthName} ${baseTitle}`;
  uiState.wizardSelections = {};
  uiState.wizardCustomItems = [];

  ml.items.forEach((item, index) => {
    // Pre-select first ~65% of items so user can immediately see how ticking works or customize
    uiState.wizardSelections[item.id] = {
      selected: index < Math.ceil(ml.items.length * 0.65),
      masterItemId: item.id,
      name: item.name,
      category: item.category,
      qty: item.defaultQty,
      unit: item.defaultUnit,
      brand: item.brand || '',
      estimatedPrice: item.estimatedPrice || 0
    };
  });

  uiState.activeTab = 'lists';
  uiState.listsSubView = 'wizard';
  renderApp();
}

function groupByCategory(items) {
  const groups = {};
  for (const item of items) {
    const cat = item.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

function renderMarkdownWithChecklists(mdText, noteId) {
  const lines = (mdText || '').split('\n');
  let html = '';
  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      html += `<h4 style="margin:8px 0 4px;font-size:0.9rem;color:var(--brand-text);">${escapeHtml(trimmed.slice(4))}</h4>`;
    } else if (/^- \[(x| )\] /i.test(trimmed)) {
      const isChecked = trimmed.toLowerCase().startsWith('- [x] ');
      const label = trimmed.slice(6);
      html += `
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer;" data-action="toggle-note-check" data-note-id="${escapeHtml(noteId)}" data-line-idx="${lineIdx}">
          <span class="custom-checkbox ${isChecked ? 'checked' : ''}" style="width:17px;height:17px;font-size:0.68rem;">${isChecked ? '✓' : ''}</span>
          <span style="font-size:0.85rem;${isChecked ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${escapeHtml(label)}</span>
        </div>`;
    } else if (trimmed.startsWith('- ')) {
      const content = escapeHtml(trimmed.slice(2))
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html += `<div style="font-size:0.85rem;margin:3px 0 3px 12px;">• ${content}</div>`;
    } else if (trimmed.length > 0) {
      const content = escapeHtml(trimmed)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html += `<p style="font-size:0.85rem;margin:4px 0;color:var(--text-secondary);">${content}</p>`;
    }
  });
  return html;
}

// ============================================================================
// VIEW 1: LISTS (ACTIVE LISTS, MASTER BLUEPRINTS, WIZARD & EXECUTION MODE)
// ============================================================================
function renderListsView(state, lang) {
  const q = uiState.searchQuery.trim().toLowerCase();

  if (uiState.listsSubView === 'wizard') {
    return renderWizardView(state, lang);
  }
  if (uiState.listsSubView === 'execute') {
    return renderActiveExecutionView(state, lang);
  }
  if (uiState.listsSubView === 'masterDetail') {
    return renderMasterDetailView(state, lang);
  }

  const filteredMasters = state.masterLists.filter((ml) => {
    if (!q) return true;
    return (
      ml.title.toLowerCase().includes(q) ||
      ml.category.toLowerCase().includes(q) ||
      ml.items.some((i) => i.name.toLowerCase().includes(q) || (i.brand && i.brand.toLowerCase().includes(q)))
    );
  });

  const filteredActives = state.activeLists.filter((al) => {
    if (!q) return true;
    return (
      al.title.toLowerCase().includes(q) ||
      al.items.some((i) => i.name.toLowerCase().includes(q) || (i.brand && i.brand.toLowerCase().includes(q)))
    );
  });

  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div class="segmented-tabs" style="margin-bottom:0;">
          <button id="tab-btn-active-lists" class="seg-btn ${uiState.listsSubView === 'active' ? 'active' : ''}" data-action="switch-lists-subview" data-subview="active">
            ⚡ ${escapeHtml(t(lang, 'activeListsTab'))}
            <span class="count-badge">${filteredActives.length}</span>
          </button>
          <button id="tab-btn-master-lists" class="seg-btn ${uiState.listsSubView === 'master' ? 'active' : ''}" data-action="switch-lists-subview" data-subview="master">
            📐 ${escapeHtml(t(lang, 'masterListsTab'))}
            <span class="count-badge">${filteredMasters.length}</span>
          </button>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${
            uiState.listsSubView === 'master'
              ? `<button id="btn-new-master-blueprint" class="btn btn-primary" data-action="toggle-new-master-modal">${escapeHtml(t(lang, 'newMasterList'))}</button>`
              : `<button id="btn-launch-wizard-default" class="btn btn-amber" data-action="open-wizard" data-master-id="${escapeHtml(state.masterLists[0]?.id || '')}">
                  ✨ ${escapeHtml(t(lang, 'createNewActiveList'))}
                </button>`
          }
        </div>
      </div>

      ${uiState.showNewMasterModal ? renderNewMasterForm() : ''}

      ${
        uiState.listsSubView === 'master'
          ? `
        <div class="cards-grid">
          ${filteredMasters
            .map((ml) => {
              const totalBlueprintCost = ml.items.reduce((acc, it) => acc + (Number(it.estimatedPrice) || 0), 0);
              const categories = [...new Set(ml.items.map((i) => i.category))];
              return `
                <article class="surface-card">
                  <div>
                    <div class="card-top-row">
                      <div style="display:flex;gap:12px;align-items:flex-start;">
                        <div class="card-icon-badge">${escapeHtml(ml.icon || '📋')}</div>
                        <div>
                          <h2 class="card-title">${escapeHtml(ml.title)}</h2>
                          <div class="card-meta">${escapeHtml(ml.category)} · <strong>${ml.items.length} items</strong> · Est. ${formatINR(totalBlueprintCost)}</div>
                        </div>
                      </div>
                    </div>
                    <p style="font-size:0.83rem;color:var(--text-secondary);margin:10px 0;">${escapeHtml(ml.description)}</p>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                      ${categories.map((c) => `<span class="tag-chip">${escapeHtml(c)}</span>`).join('')}
                    </div>
                  </div>

                  <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid var(--border-color);">
                    <button class="btn btn-amber btn-sm" style="flex:1;" data-action="open-wizard" data-master-id="${escapeHtml(ml.id)}">
                      ✨ ${escapeHtml(t(lang, 'generateSubListBtn'))}
                    </button>
                    <button class="btn btn-secondary btn-sm" data-action="open-master-detail" data-master-id="${escapeHtml(ml.id)}">
                      ⚙️ Edit Blueprint (${ml.items.length})
                    </button>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `
          : `
        <!-- Quick Blueprint Launcher Strip -->
        <div class="form-panel" style="padding:14px 18px;background:var(--bg-subtle);border-color:color-mix(in srgb, var(--brand-primary) 30%, transparent);">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:0.88rem;font-weight:700;color:var(--text-primary);">🚀 Generate a New Active List from a Master Blueprint</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);">Pick a reusable Master List, tick only the items needed this time, and customize quantities inline:</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${state.masterLists
                .map(
                  (ml) => `
                <button class="btn btn-secondary btn-sm" data-action="open-wizard" data-master-id="${escapeHtml(ml.id)}">
                  ${escapeHtml(ml.icon)} + ${escapeHtml(ml.title.split('(')[0].replace(/Master List|Blueprint/gi, '').trim())}
                </button>`
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="cards-grid">
          ${filteredActives
            .map((al) => {
              const totalCount = al.items.length;
              const doneCount = al.items.filter((i) => i.checked).length;
              const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
              const totalCost = al.items.reduce((s, i) => s + (Number(i.estimatedPrice) || 0), 0);

              return `
                <article class="surface-card">
                  <div>
                    <div class="card-top-row">
                      <div style="display:flex;gap:12px;align-items:flex-start;">
                        <div class="card-icon-badge">${escapeHtml(al.icon || '🛒')}</div>
                        <div>
                          <h2 class="card-title">${escapeHtml(al.title)}</h2>
                          <div class="card-meta">From: ${escapeHtml(al.masterListTitle)}</div>
                        </div>
                      </div>
                      <button class="btn btn-ghost btn-sm" title="Delete Active List" data-action="delete-active-list" data-active-id="${escapeHtml(al.id)}">🗑️</button>
                    </div>

                    <div style="margin-top:14px;">
                      <div style="display:flex;justify-content:space-between;font-size:0.8rem;font-weight:600;margin-bottom:4px;">
                        <span>${doneCount} / ${totalCount} ${escapeHtml(t(lang, 'completedItems'))} (${pct}%)</span>
                        <span style="color:var(--brand-text);">${escapeHtml(t(lang, 'estimatedTotal'))}: ${formatINR(totalCost)}</span>
                      </div>
                      <div class="progress-track">
                        <div class="progress-fill" style="width:${pct}%;"></div>
                      </div>
                    </div>

                    <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;">
                      ${al.items
                        .slice(0, 4)
                        .map(
                          (item) => `
                        <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:${item.checked ? 'var(--text-muted)' : 'var(--text-secondary)'};">
                          <span style="${item.checked ? 'text-decoration:line-through;' : ''}">${item.checked ? '✓' : '○'} ${escapeHtml(item.name.split('(')[0])}</span>
                          <span style="font-weight:600;">${escapeHtml(item.qty)} ${escapeHtml(item.unit)}</span>
                        </div>`
                        )
                        .join('')}
                      ${al.items.length > 4 ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">+ ${al.items.length - 4} more items...</div>` : ''}
                    </div>
                  </div>

                  <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid var(--border-color);">
                    <button class="btn btn-primary btn-sm" style="flex:1;" data-action="open-active-execution" data-active-id="${escapeHtml(al.id)}">
                      ✅ ${escapeHtml(t(lang, 'executeListBtn'))}
                    </button>
                    <button class="btn btn-secondary btn-sm" data-action="jump-to-offers" data-active-id="${escapeHtml(al.id)}">
                      🏷️ ${escapeHtml(t(lang, 'comparePricesBtn'))}
                    </button>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `
      }
    </div>
  `;
}

function renderNewMasterForm() {
  return `
    <form id="form-create-master" class="form-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 style="font-size:1rem;">📐 Create New Reusable Master List Blueprint</h3>
        <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-new-master-modal">✕ Close</button>
      </div>
      <div class="form-grid">
        <div class="field-group">
          <label>Blueprint Title *</label>
          <input type="text" name="title" class="field-input" placeholder="e.g., Camping & Trekking Master List" required />
        </div>
        <div class="field-group">
          <label>Category</label>
          <input type="text" name="category" class="field-input" placeholder="e.g., Outdoors / Health / Office" value="Custom Blueprint" />
        </div>
        <div class="field-group">
          <label>Icon Emoji</label>
          <input type="text" name="icon" class="field-input" value="🏕️" maxlength="4" />
        </div>
        <div class="field-group">
          <label>Short Description</label>
          <input type="text" name="description" class="field-input" placeholder="Reusable checklist template..." />
        </div>
      </div>
      <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
        <button type="submit" class="btn btn-primary">Save Master Blueprint</button>
      </div>
    </form>
  `;
}

// Master Blueprint Editor View
function renderMasterDetailView(state, lang) {
  const ml = state.masterLists.find((m) => m.id === uiState.selectedMasterId) || state.masterLists[0];
  if (!ml) {
    uiState.listsSubView = 'master';
    return renderListsView(state, lang);
  }
  const grouped = groupByCategory(ml.items);

  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        <button class="btn btn-secondary btn-sm" data-action="switch-lists-subview" data-subview="master">← Back to Master Blueprints</button>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-amber btn-sm" data-action="open-wizard" data-master-id="${escapeHtml(ml.id)}">
            ✨ ${escapeHtml(t(lang, 'generateSubListBtn'))}
          </button>
        </div>
      </div>

      <div class="form-panel">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div class="card-icon-badge">${escapeHtml(ml.icon)}</div>
          <div>
            <h2 style="font-size:1.15rem;">${escapeHtml(ml.title)}</h2>
            <p style="font-size:0.82rem;color:var(--text-secondary);">${escapeHtml(ml.description)}</p>
          </div>
        </div>

        <form id="form-add-master-item" data-master-id="${escapeHtml(ml.id)}" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border-color);">
          <div style="font-size:0.85rem;font-weight:700;margin-bottom:6px;">${escapeHtml(t(lang, 'addItemToMaster'))}</div>
          <div class="form-grid">
            <div class="field-group">
              <label>Item Name (English / हिंदी) *</label>
              <input type="text" name="name" class="field-input" placeholder="e.g., Organic Roasted Makhana (मखाना)" required />
            </div>
            <div class="field-group">
              <label>Category</label>
              <input type="text" name="category" class="field-input" placeholder="e.g., Grains & Flours / Snacks" value="Grains & Flours" />
            </div>
            <div class="field-group">
              <label>Default Qty & Unit</label>
              <div style="display:flex;gap:6px;">
                <input type="number" step="any" name="defaultQty" class="field-input" value="1" style="width:80px;" required />
                <select name="defaultUnit" class="field-select" style="flex:1;">
                  ${UNITS.map((u) => `<option value="${u}">${u}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="field-group">
              <label>Preferred Brand / Notes</label>
              <input type="text" name="brand" class="field-input" placeholder="e.g., Farmley / Tata Sampann" />
            </div>
            <div class="field-group">
              <label>Estimated Price (₹)</label>
              <input type="number" name="estimatedPrice" class="field-input" value="180" min="0" />
            </div>
          </div>
          <div style="margin-top:12px;display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary btn-sm">+ Add to Master Blueprint</button>
          </div>
        </form>
      </div>

      ${Object.entries(grouped)
        .map(
          ([cat, items]) => `
        <div class="category-block">
          <div class="category-header">
            <span>${escapeHtml(cat)}</span>
            <span>${items.length} Blueprint Items</span>
          </div>
          ${items
            .map(
              (item) => `
            <div class="item-row">
              <div style="flex:1;min-width:200px;">
                <div class="item-title-text">${escapeHtml(item.name)}</div>
                <div class="item-sub-text">Brand/Note: ${escapeHtml(item.brand || 'Any')} · Default: <strong>${escapeHtml(item.defaultQty)} ${escapeHtml(item.defaultUnit)}</strong></div>
              </div>
              <div class="item-controls-inline">
                <span class="price-tag-pill">${formatINR(item.estimatedPrice)}</span>
                <button class="btn btn-ghost btn-sm" data-action="delete-master-item" data-master-id="${escapeHtml(ml.id)}" data-item-id="${escapeHtml(item.id)}">🗑️</button>
              </div>
            </div>`
            )
            .join('')}
        </div>`
        )
        .join('')}
    </div>
  `;
}

// Wizard Workflow: Generate Active List from Master Blueprint
function renderWizardView(state, lang) {
  const ml = state.masterLists.find((m) => m.id === uiState.wizardMasterId) || state.masterLists[0];
  if (!ml) {
    uiState.listsSubView = 'active';
    return renderListsView(state, lang);
  }

  const allItems = Object.values(uiState.wizardSelections);
  const selectedItems = allItems.filter((i) => i.selected);
  const customSelected = uiState.wizardCustomItems;
  const totalSelectedCount = selectedItems.length + customSelected.length;
  const totalEstimated =
    selectedItems.reduce((s, i) => s + (Number(i.estimatedPrice) || 0), 0) +
    customSelected.reduce((s, i) => s + (Number(i.estimatedPrice) || 0), 0);

  const grouped = groupByCategory(allItems);

  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <button class="btn btn-secondary btn-sm" data-action="switch-lists-subview" data-subview="active">← Cancel Wizard</button>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" data-action="wizard-select-all" data-select="true">☑️ Select All</button>
          <button class="btn btn-ghost btn-sm" data-action="wizard-select-all" data-select="false">☐ Clear All</button>
        </div>
      </div>

      <div class="form-panel" style="border-left:4px solid var(--brand-primary);">
        <h2 style="font-size:1.15rem;">✨ ${escapeHtml(t(lang, 'wizardTitle'))}</h2>
        <p style="font-size:0.83rem;color:var(--text-secondary);margin-top:2px;">
          Blueprint: <strong>${escapeHtml(ml.title)}</strong> — ${escapeHtml(t(lang, 'wizardSubtitle'))}
        </p>

        <div class="form-grid" style="margin-top:14px;align-items:end;">
          <div class="field-group" style="grid-column: span 2;">
            <label>New Active List Name *</label>
            <input id="wizard-list-title-input" type="text" class="field-input" value="${escapeHtml(uiState.wizardListTitle)}" placeholder="e.g., November 2026 Monthly Grocery" />
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-subtle);padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border-color);">
            <div>
              <div style="font-size:0.75rem;color:var(--text-secondary);">Selected Items</div>
              <div style="font-size:1.05rem;font-weight:800;color:var(--brand-text);">${totalSelectedCount} items · ${formatINR(totalEstimated)}</div>
            </div>
            <button id="btn-confirm-create-active-list" class="btn btn-amber" data-action="confirm-create-active-list">
              🚀 Create List (${totalSelectedCount})
            </button>
          </div>
        </div>
      </div>

      <!-- Grouped Master Items with Inline Checkbox + Qty + Unit + Price Controls -->
      ${Object.entries(grouped)
        .map(
          ([cat, items]) => `
        <div class="category-block">
          <div class="category-header">
            <span>${escapeHtml(cat)}</span>
            <span>${items.filter((i) => i.selected).length} / ${items.length} selected</span>
          </div>
          ${items
            .map(
              (item) => `
            <div class="item-row" style="${item.selected ? 'background:color-mix(in srgb, var(--brand-soft) 32%, transparent);' : 'opacity:0.72;'}">
              <div class="item-left" data-action="wizard-toggle-item" data-item-id="${escapeHtml(item.masterItemId)}">
                <div class="custom-checkbox ${item.selected ? 'checked' : ''}">${item.selected ? '✓' : ''}</div>
                <div>
                  <div class="item-title-text">${escapeHtml(item.name)}</div>
                  <div class="item-sub-text">${escapeHtml(item.brand || 'Standard quality')}</div>
                </div>
              </div>

              <div class="item-controls-inline">
                <label style="font-size:0.74rem;color:var(--text-secondary);">Qty:</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  class="inline-input-num"
                  value="${escapeHtml(item.qty)}"
                  data-action="wizard-change-qty"
                  data-item-id="${escapeHtml(item.masterItemId)}"
                />
                <select class="inline-select-unit" data-action="wizard-change-unit" data-item-id="${escapeHtml(item.masterItemId)}">
                  ${UNITS.map((u) => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
                </select>
                <label style="font-size:0.74rem;color:var(--text-secondary);">₹:</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  class="inline-input-num"
                  value="${escapeHtml(item.estimatedPrice)}"
                  data-action="wizard-change-price"
                  data-item-id="${escapeHtml(item.masterItemId)}"
                />
              </div>
            </div>`
            )
            .join('')}
        </div>`
        )
        .join('')}

      <!-- One-Off Custom Item Adder (with "Also save to Master List for future" checkbox) -->
      <form id="form-wizard-add-custom" class="form-panel">
        <h3 style="font-size:0.95rem;">➕ ${escapeHtml(t(lang, 'addCustomOneOff'))}</h3>
        ${
          uiState.wizardCustomItems.length > 0
            ? `<div style="margin:10px 0;display:flex;flex-direction:column;gap:6px;">
                ${uiState.wizardCustomItems
                  .map(
                    (ci, idx) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-elevated);border-radius:8px;font-size:0.84rem;">
                    <span>✅ <strong>${escapeHtml(ci.name)}</strong> (${escapeHtml(ci.qty)} ${escapeHtml(ci.unit)} · ${formatINR(ci.estimatedPrice)}) ${
                      ci.saveToMaster ? '<span class="zk-pill" style="margin-left:6px;">+ Saved to Master Blueprint</span>' : ''
                    }</span>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="wizard-remove-custom" data-idx="${idx}">✕</button>
                  </div>`
                  )
                  .join('')}
              </div>`
            : ''
        }
        <div class="form-grid">
          <div class="field-group">
            <label>Custom Item Name *</label>
            <input type="text" name="name" class="field-input" placeholder="e.g., Birthday Cake / Extra batteries" required />
          </div>
          <div class="field-group">
            <label>Category</label>
            <input type="text" name="category" class="field-input" value="Special Addition" />
          </div>
          <div class="field-group">
            <label>Qty & Unit</label>
            <div style="display:flex;gap:6px;">
              <input type="number" step="any" name="qty" class="field-input" value="1" style="width:76px;" />
              <select name="unit" class="field-select" style="flex:1;">
                ${UNITS.map((u) => `<option value="${u}">${u}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field-group">
            <label>Brand / Note</label>
            <input type="text" name="brand" class="field-input" placeholder="Optional brand" />
          </div>
          <div class="field-group">
            <label>Est. Price (₹)</label>
            <input type="number" name="estimatedPrice" class="field-input" value="100" />
          </div>
        </div>
        <div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:0.84rem;font-weight:600;cursor:pointer;">
            <input type="checkbox" name="saveToMaster" checked style="width:16px;height:16px;" />
            ${escapeHtml(t(lang, 'alsoSaveToMaster'))}
          </label>
          <button type="submit" class="btn btn-secondary btn-sm">+ Add Custom Item to Selection</button>
        </div>
      </form>
    </div>
  `;
}

// Active List Execution Mode (Shopping / Packing Checklist)
function renderActiveExecutionView(state, lang) {
  const al = state.activeLists.find((l) => l.id === uiState.selectedActiveId) || state.activeLists[0];
  if (!al) {
    uiState.listsSubView = 'active';
    return renderListsView(state, lang);
  }

  const totalItems = al.items.length;
  const checkedItems = al.items.filter((i) => i.checked).length;
  const pct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  const totalCost = al.items.reduce((s, i) => s + (Number(i.estimatedPrice) || 0), 0);
  const checkedCost = al.items.filter((i) => i.checked).reduce((s, i) => s + (Number(i.estimatedPrice) || 0), 0);
  const remainingCost = Math.max(0, totalCost - checkedCost);

  const grouped = groupByCategory(al.items);
  const linkedNotes = state.notes.filter((n) => n.linkedListId === al.id);

  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <button class="btn btn-secondary btn-sm" data-action="switch-lists-subview" data-subview="active">← All Active Lists</button>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <button class="btn btn-amber btn-sm" data-action="jump-to-offers" data-active-id="${escapeHtml(al.id)}">
            🏷️ ${escapeHtml(t(lang, 'comparePricesBtn'))}
          </button>
          <button class="btn btn-secondary btn-sm" data-action="share-list-whatsapp" data-active-id="${escapeHtml(al.id)}">
            💬 ${escapeHtml(t(lang, 'shareWhatsAppBtn'))}
          </button>
          <button class="btn btn-ghost btn-sm" data-action="copy-list-text" data-active-id="${escapeHtml(al.id)}">
            📋 ${escapeHtml(t(lang, 'copyTextBtn'))}
          </button>
        </div>
      </div>

      <!-- Execution Header Summary Card -->
      <div class="form-panel">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;gap:12px;align-items:center;">
            <div class="card-icon-badge">${escapeHtml(al.icon || '🛒')}</div>
            <div>
              <h2 style="font-size:1.18rem;">${escapeHtml(al.title)}</h2>
              <div style="font-size:0.8rem;color:var(--text-secondary);">Blueprint: ${escapeHtml(al.masterListTitle)}</div>
            </div>
          </div>

          <div style="display:flex;gap:16px;flex-wrap:wrap;background:var(--bg-elevated);padding:10px 16px;border-radius:var(--radius-sm);">
            <div>
              <div style="font-size:0.72rem;color:var(--text-secondary);">Cart / Checked</div>
              <div style="font-size:0.95rem;font-weight:700;color:var(--success);">${formatINR(checkedCost)}</div>
            </div>
            <div>
              <div style="font-size:0.72rem;color:var(--text-secondary);">Remaining</div>
              <div style="font-size:0.95rem;font-weight:700;">${formatINR(remainingCost)}</div>
            </div>
            <div>
              <div style="font-size:0.72rem;color:var(--text-secondary);">${escapeHtml(t(lang, 'estimatedTotal'))}</div>
              <div style="font-size:1rem;font-weight:800;color:var(--brand-text);">${formatINR(totalCost)}</div>
            </div>
          </div>
        </div>

        <div style="margin-top:14px;">
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700;margin-bottom:4px;">
            <span>Progress: ${checkedItems} of ${totalItems} completed (${pct}%)</span>
            <span>${totalItems - checkedItems} pending</span>
          </div>
          <div class="progress-track" style="height:10px;">
            <div class="progress-fill" style="width:${pct}%;"></div>
          </div>
        </div>

        ${
          linkedNotes.length > 0
            ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border-color);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:0.78rem;color:var(--text-secondary);">📝 Linked Notes:</span>
                ${linkedNotes
                  .map(
                    (n) =>
                      `<button class="link-badge" data-action="open-linked-note" data-note-id="${escapeHtml(n.id)}">📄 ${escapeHtml(n.title)}</button>`
                  )
                  .join('')}
              </div>`
            : ''
        }
      </div>

      <!-- Checklist Grouped by Category -->
      ${Object.entries(grouped)
        .map(
          ([cat, items]) => `
        <div class="category-block">
          <div class="category-header">
            <span>${escapeHtml(cat)}</span>
            <span>${items.filter((i) => i.checked).length} / ${items.length} done</span>
          </div>
          ${items
            .map(
              (item) => `
            <div class="item-row ${item.checked ? 'checked-row' : ''}">
              <div class="item-left" data-action="toggle-active-item" data-active-id="${escapeHtml(al.id)}" data-item-id="${escapeHtml(item.id)}">
                <div class="custom-checkbox ${item.checked ? 'checked' : ''}">${item.checked ? '✓' : ''}</div>
                <div>
                  <div class="item-title-text">${escapeHtml(item.name)}</div>
                  <div class="item-sub-text">${escapeHtml(item.brand || 'Any brand')}</div>
                </div>
              </div>
              <div class="item-controls-inline">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  class="inline-input-num"
                  value="${escapeHtml(item.qty)}"
                  data-action="active-change-qty"
                  data-active-id="${escapeHtml(al.id)}"
                  data-item-id="${escapeHtml(item.id)}"
                />
                <span style="font-size:0.82rem;color:var(--text-secondary);min-width:34px;">${escapeHtml(item.unit)}</span>
                <span class="price-tag-pill">${formatINR(item.estimatedPrice)}</span>
              </div>
            </div>`
            )
            .join('')}
        </div>`
        )
        .join('')}

      <!-- Quick Add One-Off Item to Active List -->
      <form id="form-active-quick-add" data-active-id="${escapeHtml(al.id)}" class="form-panel">
        <div style="font-size:0.9rem;font-weight:700;margin-bottom:8px;">➕ Add Forgot / Extra Item to This List</div>
        <div class="form-grid">
          <div class="field-group">
            <label>Item Name *</label>
            <input type="text" name="name" class="field-input" placeholder="e.g., Fresh Coriander & Green Chilli" required />
          </div>
          <div class="field-group">
            <label>Category</label>
            <input type="text" name="category" class="field-input" value="Fresh Add-on" />
          </div>
          <div class="field-group">
            <label>Qty & Unit</label>
            <div style="display:flex;gap:6px;">
              <input type="number" step="any" name="qty" class="field-input" value="1" style="width:72px;" />
              <select name="unit" class="field-select" style="flex:1;">
                ${UNITS.map((u) => `<option value="${u}">${u}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field-group">
            <label>Estimated Price (₹)</label>
            <input type="number" name="estimatedPrice" class="field-input" value="40" />
          </div>
        </div>
        <div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;cursor:pointer;">
            <input type="checkbox" name="saveToMaster" style="width:15px;height:15px;" />
            ${escapeHtml(t(lang, 'alsoSaveToMaster'))}
          </label>
          <button type="submit" class="btn btn-primary btn-sm">+ Add Item</button>
        </div>
      </form>
    </div>
  `;
}

// ============================================================================
// VIEW 2: SMART ONLINE OFFERS & DEAL FINDER (MODULE B)
// ============================================================================
function renderOffersView(state, lang) {
  const activeList =
    state.activeLists.find((l) => l.id === uiState.offersListId) || state.activeLists[0] || null;
  const comparison = compareActiveListDeals(activeList);

  return `
    <div>
      <div class="form-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="font-size:1.15rem;">🏷️ ${escapeHtml(t(lang, 'offersTitle'))}</h2>
            <p style="font-size:0.82rem;color:var(--text-secondary);">
              Compare live unit prices, pack discounts, and total cart cost across Amazon, Flipkart, BigBasket, JioMart, Blinkit, Zepto & Instamart.
            </p>
          </div>
          <div class="field-group" style="min-width:260px;">
            <label>${escapeHtml(t(lang, 'selectActiveListForOffers'))}</label>
            <select id="select-offers-active-list" class="field-select" data-action="change-offers-list">
              ${state.activeLists
                .map(
                  (l) =>
                    `<option value="${escapeHtml(l.id)}" ${l.id === activeList?.id ? 'selected' : ''}>${escapeHtml(l.icon)} ${escapeHtml(l.title)} (${l.items.length} items)</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        ${
          comparison.bestPlatform
            ? `
          <div style="margin-top:16px;padding:14px;border-radius:var(--radius-md);background:var(--bg-subtle);border:1px solid color-mix(in srgb, var(--brand-primary) 35%, transparent);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <span class="zk-pill">🏆 Best Single-App Cart</span>
              <div style="font-size:1.05rem;font-weight:800;margin-top:4px;">
                ${escapeHtml(comparison.bestPlatform.name)} — ${formatINR(comparison.bestPlatform.finalTotal)}
                <span style="font-size:0.82rem;font-weight:600;color:var(--success);margin-left:6px;">
                  (Save ${formatINR(comparison.bestPlatform.savings)} · ${comparison.bestPlatform.savingsPct}% below MRP ${formatINR(comparison.totalMrp)})
                </span>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.75rem;color:var(--text-secondary);">Cherry-Picked Best Price Across Apps</div>
              <div style="font-size:1.05rem;font-weight:800;color:var(--brand-text);">
                ${formatINR(comparison.bestSplitTotal)} (Max Save ${formatINR(comparison.maxSavings)})
              </div>
            </div>
          </div>`
            : ''
        }
      </div>

      <!-- 7-Platform Cart Summary Cards -->
      <div class="platform-summary-grid">
        ${comparison.platformTotals
          .map(
            (p, idx) => `
          <div class="platform-card ${idx === 0 ? 'best-platform' : ''}">
            ${idx === 0 ? `<span class="best-ribbon">LOWEST CART</span>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:0.96rem;">${escapeHtml(p.name)}</strong>
              <span class="tag-chip">${escapeHtml(p.eta)}</span>
            </div>
            <div style="font-size:0.74rem;color:var(--text-secondary);margin-top:2px;">${escapeHtml(p.badge)}</div>
            <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:baseline;">
              <span style="font-size:1.22rem;font-weight:800;color:var(--text-primary);">${formatINR(p.finalTotal)}</span>
              <span style="font-size:0.78rem;font-weight:700;color:var(--success);">Save ${formatINR(p.savings)}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;">
              Delivery: ${p.delivery === 0 ? 'FREE' : formatINR(p.delivery)}
            </div>
          </div>`
          )
          .join('')}
      </div>

      <!-- Item-by-Item Multi-Platform Price Comparison -->
      <div class="category-block">
        <div class="category-header">
          <span>Item-Wise Deals & Direct Store Deep-Links (${comparison.itemComparisons.length} Items)</span>
          <span>Click any store box to open search</span>
        </div>
        ${comparison.itemComparisons
          .map(
            (item) => `
          <div class="item-row" style="flex-direction:column;align-items:stretch;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <div>
                <span class="item-title-text">${escapeHtml(item.name)}</span>
                <span class="tag-chip" style="margin-left:6px;">${escapeHtml(item.qty)} ${escapeHtml(item.unit)}</span>
                <div class="item-sub-text">Preferred: ${escapeHtml(item.brand || 'Any')} · MRP: <span style="text-decoration:line-through;">${formatINR(item.mrp)}</span></div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="zk-pill" style="background:var(--success-soft);color:var(--success);">
                  Best: ${escapeHtml(item.bestQuote.platformName)} @ ${formatINR(item.bestQuote.price)} (${item.bestQuote.discountPct}% OFF)
                </span>
              </div>
            </div>

            <div class="deal-quotes-row">
              ${item.quotes
                .map((q) => {
                  const isLowest = q.price === item.bestQuote.price;
                  return `
                    <a href="${escapeHtml(q.url)}" target="_blank" rel="noopener noreferrer" class="deal-quote-box ${isLowest ? 'lowest-quote' : ''}">
                      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.76rem;font-weight:700;">
                        <span>${escapeHtml(q.platformName)}</span>
                        <span>↗</span>
                      </div>
                      <div style="font-size:1rem;font-weight:800;margin:2px 0;">
                        ${formatINR(q.price)}
                        <span style="font-size:0.7rem;font-weight:600;color:var(--text-muted);text-decoration:line-through;">${formatINR(q.mrp)}</span>
                      </div>
                      <div style="font-size:0.69rem;color:${isLowest ? 'var(--success)' : 'var(--text-secondary)'};font-weight:600;">
                        ${escapeHtml(q.promoLabel)}
                      </div>
                    </a>
                  `;
                })
                .join('')}
            </div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  `;
}

// ============================================================================
// VIEW 3: RICH NOTES & QUICK VOICE CAPTURE (MODULE C)
// ============================================================================
function renderNotesView(state, lang) {
  const q = uiState.searchQuery.trim().toLowerCase();
  const allTags = [...new Set(state.notes.flatMap((n) => n.tags || []))];

  const filteredNotes = state.notes.filter((n) => {
    if (uiState.noteTagFilter !== 'ALL' && !(n.tags || []).includes(uiState.noteTagFilter)) {
      return false;
    }
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const pinned = filteredNotes.filter((n) => n.pinned);
  const others = filteredNotes.filter((n) => !n.pinned);

  const draft = uiState.editingNote;

  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        <div>
          <h2 style="font-size:1.15rem;">📝 ${escapeHtml(t(lang, 'notesTitle'))}</h2>
          <p style="font-size:0.8rem;color:var(--text-secondary);">Markdown checklists, color-coding, voice dictation, and two-way links to Active Lists & Contacts.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="btn-voice-note" class="btn ${uiState.isRecordingVoice ? 'btn-danger' : 'btn-secondary'}" data-action="start-voice-note">
            🎙️ ${escapeHtml(uiState.isRecordingVoice ? t(lang, 'voiceListening') : t(lang, 'voiceCaptureBtn'))}
          </button>
          <button id="btn-new-note" class="btn btn-primary" data-action="open-note-editor">
            ${escapeHtml(t(lang, 'newNoteBtn'))}
          </button>
        </div>
      </div>

      <!-- Tag Filter Pills -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn ${uiState.noteTagFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="filter-note-tag" data-tag="ALL">All Notes (${state.notes.length})</button>
        ${allTags
          .map(
            (tag) => `
          <button class="btn ${uiState.noteTagFilter === tag ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="filter-note-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`
          )
          .join('')}
      </div>

      ${
        draft
          ? `
        <form id="form-save-note" class="form-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h3 style="font-size:0.98rem;">${draft.id ? '✏️ Edit Rich Note' : '✨ New Rich Note'}</h3>
            <button type="button" class="btn btn-ghost btn-sm" data-action="close-note-editor">✕ Cancel</button>
          </div>
          <input type="hidden" name="id" value="${escapeHtml(draft.id || '')}" />
          <div class="form-grid">
            <div class="field-group" style="grid-column: span 2;">
              <label>Note Title *</label>
              <input id="note-editor-title" type="text" name="title" class="field-input" value="${escapeHtml(draft.title)}" placeholder="e.g., Diwali Shopping & Gift Allocation" required />
            </div>
            <div class="field-group">
              <label>Color Accent</label>
              <select name="color" class="field-select">
                ${['teal', 'amber', 'emerald', 'rose', 'sky']
                  .map((c) => `<option value="${c}" ${draft.color === c ? 'selected' : ''}>${c.toUpperCase()}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="field-group">
              <label>Tags (comma separated)</label>
              <input type="text" name="tags" class="field-input" value="${escapeHtml((draft.tags || []).join(', '))}" placeholder="Travel, Grocery, Ideas" />
            </div>
            <div class="field-group">
              <label>Link to Active List (Optional)</label>
              <select name="linkedListId" class="field-select">
                <option value="">— None —</option>
                ${state.activeLists
                  .map(
                    (al) =>
                      `<option value="${escapeHtml(al.id)}" ${draft.linkedListId === al.id ? 'selected' : ''}>${escapeHtml(al.icon)} ${escapeHtml(al.title)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="field-group">
              <label>Link to Contact Card (Optional)</label>
              <select name="linkedCardId" class="field-select">
                <option value="">— None —</option>
                ${state.cards
                  .map(
                    (c) =>
                      `<option value="${escapeHtml(c.id)}" ${draft.linkedCardId === c.id ? 'selected' : ''}>👤 ${escapeHtml(c.fullName)} (${escapeHtml(c.company)})</option>`
                  )
                  .join('')}
              </select>
            </div>
          </div>

          <div class="field-group" style="margin-top:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <label>Markdown Content & Interactive Checklists (Use <code>- [ ] task</code> or <code>### Heading</code>)</label>
              <button type="button" class="btn btn-ghost btn-sm" data-action="insert-note-checklist-template">+ Insert Checklist Row</button>
            </div>
            <textarea id="note-editor-content" name="content" class="field-textarea" placeholder="Write notes, itineraries, or - [ ] checklist items...">${escapeHtml(draft.content)}</textarea>
          </div>

          <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
            <label style="display:flex;align-items:center;gap:6px;font-size:0.84rem;cursor:pointer;">
              <input type="checkbox" name="pinned" ${draft.pinned ? 'checked' : ''} /> 📌 Pin Note to Top
            </label>
            <button type="submit" class="btn btn-primary">💾 Save Note</button>
          </div>
        </form>
      `
          : ''
      }

      ${
        pinned.length > 0
          ? `<h3 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);margin-bottom:10px;">📌 ${escapeHtml(t(lang, 'pinnedNotes'))}</h3>
             <div class="cards-grid" style="margin-bottom:20px;">
               ${pinned.map((n) => renderSingleNoteCard(n, state)).join('')}
             </div>`
          : ''
      }

      ${
        others.length > 0
          ? `<h3 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);margin-bottom:10px;">📄 ${escapeHtml(t(lang, 'allNotes'))}</h3>
             <div class="cards-grid">
               ${others.map((n) => renderSingleNoteCard(n, state)).join('')}
             </div>`
          : ''
      }
    </div>
  `;
}

function renderSingleNoteCard(note, state) {
  const linkedList = state.activeLists.find((l) => l.id === note.linkedListId);
  const linkedCard = state.cards.find((c) => c.id === note.linkedCardId);

  return `
    <article class="surface-card note-card-${escapeHtml(note.color || 'teal')}">
      <div>
        <div class="card-top-row">
          <h3 class="card-title">${escapeHtml(note.title)}</h3>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-sm" title="Pin/Unpin" data-action="toggle-pin-note" data-note-id="${escapeHtml(note.id)}">${note.pinned ? '📌' : '📍'}</button>
            <button class="btn btn-ghost btn-sm" title="Edit Note" data-action="edit-note" data-note-id="${escapeHtml(note.id)}">✏️</button>
            <button class="btn btn-ghost btn-sm" title="Delete Note" data-action="delete-note" data-note-id="${escapeHtml(note.id)}">🗑️</button>
          </div>
        </div>

        <div style="margin-top:10px;">
          ${renderMarkdownWithChecklists(note.content, note.id)}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px solid var(--border-color);">
        ${
          linkedList || linkedCard
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${
                  linkedList
                    ? `<button class="link-badge" data-action="open-active-execution" data-active-id="${escapeHtml(linkedList.id)}">
                        🔗 List: ${escapeHtml(linkedList.title.split('(')[0].trim())}
                      </button>`
                    : ''
                }
                ${
                  linkedCard
                    ? `<button class="link-badge" data-action="jump-to-card" data-card-id="${escapeHtml(linkedCard.id)}">
                        👤 Contact: ${escapeHtml(linkedCard.fullName)}
                      </button>`
                    : ''
                }
              </div>`
            : ''
        }
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            ${(note.tags || []).map((tag) => `<span class="tag-chip">#${escapeHtml(tag)}</span>`).join('')}
          </div>
          <span style="font-size:0.7rem;color:var(--text-muted);">${new Date(note.updatedAt).toLocaleDateString('en-IN')}</span>
        </div>
      </div>
    </article>
  `;
}

// ============================================================================
// VIEW 4: VISITING / BUSINESS CARD SCANNER & CONTACT VAULT (MODULE D)
// ============================================================================
function renderCardsView(state, lang) {
  const q = uiState.searchQuery.trim().toLowerCase();
  const categories = ['ALL', 'Vendor', 'Doctor', 'Technician', 'Consultant', 'Business'];

  const filteredCards = state.cards.filter((c) => {
    if (uiState.cardFilterCategory !== 'ALL' && c.category !== uiState.cardFilterCategory) {
      return false;
    }
    if (!q) return true;
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.designation.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  const d = uiState.cardDraft;

  return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        <div>
          <h2 style="font-size:1.15rem;">🪪 ${escapeHtml(t(lang, 'cardsTitle'))}</h2>
          <p style="font-size:0.8rem;color:var(--text-secondary);">
            On-device OCR extracts Name, Role, Organization, Phone, Email, Website & Address with 1-tap Call, WhatsApp, Map & .vcf Contact Export.
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="btn-open-card-scanner" class="btn btn-amber" data-action="toggle-card-scanner">
            📷 ${escapeHtml(t(lang, 'scanNewCardBtn'))}
          </button>
        </div>
      </div>

      <!-- Category Filter Bar -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">
        ${categories
          .map(
            (cat) => `
          <button class="btn ${uiState.cardFilterCategory === cat ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="filter-card-category" data-category="${escapeHtml(cat)}">
            ${cat === 'ALL' ? `All Cards (${state.cards.length})` : escapeHtml(cat)}
          </button>`
          )
          .join('')}
      </div>

      ${
        uiState.showCardScannerPanel
          ? `
        <div class="form-panel" style="border-left:4px solid var(--accent-amber);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            <div>
              <h3 style="font-size:1.02rem;">🔍 Visiting Card Camera Capture & On-Device OCR</h3>
              <p style="font-size:0.78rem;color:var(--text-secondary);">Upload a photo, capture from camera, or click a Demo Visiting Card below to test live OCR field extraction.</p>
            </div>
            <button class="btn btn-ghost btn-sm" data-action="toggle-card-scanner">✕ Close Scanner</button>
          </div>

          <!-- Instant Demo Card Presets + Camera / Upload Controls -->
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);">
            <label class="btn btn-primary btn-sm" style="cursor:pointer;">
              📁 Upload Card Photo (Front)
              <input id="input-card-image-upload" type="file" accept="image/*" style="display:none;" />
            </label>
            <button type="button" class="btn btn-secondary btn-sm" data-action="start-camera-capture">📸 Open Live Camera</button>
            ${SAMPLE_DEMO_CARDS.map(
              (demo) => `
              <button type="button" class="btn btn-ghost btn-sm" data-action="scan-demo-card" data-demo-id="${escapeHtml(demo.id)}">
                ⚡ Scan ${escapeHtml(demo.label)}
              </button>`
            ).join('')}
          </div>

          <!-- Live Camera Stream Container (Hidden until camera opened) -->
          <div id="camera-preview-box" style="display:none;margin-bottom:14px;text-align:center;background:#000;padding:12px;border-radius:var(--radius-md);">
            <video id="camera-video-el" autoplay playsinline style="max-width:100%;max-height:260px;border-radius:8px;"></video>
            <div style="margin-top:8px;display:flex;justify-content:center;gap:8px;">
              <button type="button" class="btn btn-amber btn-sm" data-action="capture-camera-frame">📸 Capture & Run OCR</button>
              <button type="button" class="btn btn-secondary btn-sm" data-action="stop-camera-capture">Cancel Camera</button>
            </div>
          </div>

          ${
            uiState.ocrProgress > 0 && uiState.ocrProgress < 100
              ? `<div style="margin-bottom:12px;">
                  <div style="font-size:0.8rem;font-weight:700;color:var(--brand-text);">${escapeHtml(uiState.ocrStatusText)} (${uiState.ocrProgress}%)</div>
                  <div class="progress-track"><div class="progress-fill" style="width:${uiState.ocrProgress}%;"></div></div>
                </div>`
              : ''
          }

          <form id="form-save-scanned-card">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;">
              <div>
                ${
                  d.frontImage
                    ? `<img src="${d.frontImage}" alt="Scanned Visiting Card Preview" class="visiting-card-img" style="height:195px;margin-bottom:10px;" />`
                    : `<div style="height:150px;border:2px dashed var(--border-strong);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.84rem;margin-bottom:10px;">Card Preview / Paste OCR Text Below</div>`
                }
                <div class="field-group">
                  <label>Raw OCR Text (You can also paste any business card text here & click Re-Parse):</label>
                  <textarea id="ocr-raw-textarea" class="field-textarea" style="min-height:92px;font-family:monospace;font-size:0.78rem;" placeholder="Paste or edit raw text from visiting card...">${escapeHtml(d.rawOcrText)}</textarea>
                  <button type="button" class="btn btn-secondary btn-sm" style="margin-top:4px;align-self:flex-start;" data-action="reparse-ocr-text">🧠 Smart Auto-Extract Fields from Text</button>
                </div>
              </div>

              <div class="form-grid" style="margin-top:0;">
                <div class="field-group">
                  <label>Full Name *</label>
                  <input type="text" name="fullName" class="field-input" value="${escapeHtml(d.fullName)}" required />
                </div>
                <div class="field-group">
                  <label>Designation / Role</label>
                  <input type="text" name="designation" class="field-input" value="${escapeHtml(d.designation)}" />
                </div>
                <div class="field-group">
                  <label>Company / Organization</label>
                  <input type="text" name="company" class="field-input" value="${escapeHtml(d.company)}" />
                </div>
                <div class="field-group">
                  <label>Category</label>
                  <select name="category" class="field-select">
                    ${['Vendor', 'Doctor', 'Technician', 'Consultant', 'Client', 'Business']
                      .map((c) => `<option value="${c}" ${d.category === c ? 'selected' : ''}>${c}</option>`)
                      .join('')}
                  </select>
                </div>
                <div class="field-group">
                  <label>Primary Phone</label>
                  <input type="text" name="phone" class="field-input" value="${escapeHtml(d.phone)}" />
                </div>
                <div class="field-group">
                  <label>Email Address</label>
                  <input type="text" name="email" class="field-input" value="${escapeHtml(d.email)}" />
                </div>
                <div class="field-group">
                  <label>Website</label>
                  <input type="text" name="website" class="field-input" value="${escapeHtml(d.website)}" />
                </div>
                <div class="field-group">
                  <label>Custom Tags (comma separated)</label>
                  <input type="text" name="tagsText" class="field-input" value="${escapeHtml(d.tagsText)}" />
                </div>
                <div class="field-group" style="grid-column: 1 / -1;">
                  <label>Physical Address</label>
                  <input type="text" name="address" class="field-input" value="${escapeHtml(d.address)}" />
                </div>
              </div>
            </div>
            <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
              <button type="submit" class="btn btn-primary">💾 Save to Contact Vault</button>
            </div>
          </form>
        </div>
      `
          : ''
      }

      <!-- Contact Cards Vault Grid -->
      <div class="cards-grid">
        ${filteredCards
          .map((card) => {
            const cleanDigits = (card.phone || '').replace(/[^0-9]/g, '');
            const waUrl = cleanDigits ? `https://wa.me/${cleanDigits}` : '#';
            const mapUrl = card.address
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}`
              : '#';

            return `
              <article class="surface-card" id="vault-card-${escapeHtml(card.id)}">
                <div>
                  ${
                    card.frontImage
                      ? `<img src="${card.frontImage}" alt="${escapeHtml(card.fullName)} Visiting Card" class="visiting-card-img" />`
                      : ''
                  }
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:12px;">
                    <div>
                      <span class="zk-pill">${escapeHtml(card.category)}</span>
                      <h3 class="card-title" style="margin-top:6px;">${escapeHtml(card.fullName)}</h3>
                      <div class="card-meta">${escapeHtml(card.designation)} · <strong>${escapeHtml(card.company)}</strong></div>
                    </div>
                    <button class="btn btn-ghost btn-sm" data-action="delete-card" data-card-id="${escapeHtml(card.id)}">🗑️</button>
                  </div>

                  <div style="margin-top:10px;font-size:0.82rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:4px;">
                    ${card.phone ? `<div>📞 <strong>${escapeHtml(card.phone)}</strong> ${card.altPhone ? `/ ${escapeHtml(card.altPhone)}` : ''}</div>` : ''}
                    ${card.email ? `<div>✉️ ${escapeHtml(card.email)}</div>` : ''}
                    ${card.address ? `<div>📍 ${escapeHtml(card.address)}</div>` : ''}
                  </div>

                  <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">
                    ${(card.tags || []).map((tag) => `<span class="tag-chip">#${escapeHtml(tag)}</span>`).join('')}
                  </div>
                </div>

                <div class="contact-actions-bar">
                  ${
                    card.phone
                      ? `<a href="tel:${escapeHtml(card.phone)}" class="btn btn-secondary btn-sm">📞 Call</a>
                         <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">💬 WhatsApp</a>`
                      : ''
                  }
                  ${card.email ? `<a href="mailto:${escapeHtml(card.email)}" class="btn btn-secondary btn-sm">✉️ Email</a>` : ''}
                  ${card.address ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">🗺️ Map</a>` : ''}
                  <button class="btn btn-primary btn-sm" style="margin-left:auto;" data-action="export-vcf" data-card-id="${escapeHtml(card.id)}">
                    📲 ${escapeHtml(t(lang, 'exportVcfBtn'))}
                  </button>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

// ============================================================================
// VIEW 5: ZERO-KNOWLEDGE BYOS CLOUD SYNC & SETTINGS (MODULE E)
// ============================================================================
function renderSyncView(state, lang) {
  const s = state.settings;
  const gSyncTime = s.googleDriveLastSync ? new Date(s.googleDriveLastSync).toLocaleString('en-IN') : 'Ready to sync';
  const iSyncTime = s.iCloudLastSync ? new Date(s.iCloudLastSync).toLocaleString('en-IN') : 'Ready to sync';

  return `
    <div>
      <div class="form-panel" style="border-left:4px solid var(--brand-primary);">
        <span class="zk-pill">🔒 Zero-Knowledge / Bring Your Own Storage (BYOS)</span>
        <h2 style="font-size:1.18rem;margin-top:6px;">${escapeHtml(t(lang, 'syncTitle'))}</h2>
        <p style="font-size:0.84rem;color:var(--text-secondary);margin-top:3px;">
          ${escapeHtml(t(lang, 'syncSubtitle'))}
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:12px;margin-top:16px;">
          <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);">
            <div style="font-size:0.74rem;color:var(--text-secondary);">Master Blueprints</div>
            <div style="font-size:1.25rem;font-weight:800;">${state.masterLists.length}</div>
          </div>
          <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);">
            <div style="font-size:0.74rem;color:var(--text-secondary);">Active Sub-Lists</div>
            <div style="font-size:1.25rem;font-weight:800;">${state.activeLists.length}</div>
          </div>
          <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);">
            <div style="font-size:0.74rem;color:var(--text-secondary);">Rich Notes</div>
            <div style="font-size:1.25rem;font-weight:800;">${state.notes.length}</div>
          </div>
          <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);">
            <div style="font-size:0.74rem;color:var(--text-secondary);">Contact Cards</div>
            <div style="font-size:1.25rem;font-weight:800;">${state.cards.length}</div>
          </div>
        </div>
      </div>

      <!-- Cloud Providers Grid: Google Drive & iCloud Drive -->
      <div class="cards-grid" style="margin-bottom:18px;">
        <!-- Google Drive Card -->
        <div class="surface-card">
          <div>
            <div class="card-top-row">
              <div style="display:flex;gap:12px;align-items:center;">
                <div class="card-icon-badge">☁️</div>
                <div>
                  <h3 class="card-title">Google Drive Personal Sync</h3>
                  <div class="card-meta">Uses <code>appDataFolder</code> / Drive File API v3</div>
                </div>
              </div>
              <span class="zk-pill">Android / Web</span>
            </div>
            <p style="font-size:0.82rem;color:var(--text-secondary);margin-top:10px;">
              Syncs an encrypted or JSON snapshot directly to your personal Google Drive <code>appDataFolder</code>. Last synced: <strong>${escapeHtml(gSyncTime)}</strong>
            </p>
            <div class="field-group" style="margin-top:10px;">
              <label>Optional Google OAuth Access Token (for direct Drive v3 API upload):</label>
              <input id="input-google-token" type="password" class="field-input" placeholder="Leave blank for instant local-cloud vault mirror" />
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border-color);">
            <button id="btn-sync-gdrive" class="btn btn-primary" style="flex:1;" data-action="sync-google-drive">
              🔄 Sync with Google Drive
            </button>
            <button class="btn btn-secondary" data-action="restore-cloud-snapshot">
              📥 Pull Cloud Snapshot
            </button>
          </div>
        </div>

        <!-- iCloud Drive / Apple File System Card -->
        <div class="surface-card">
          <div>
            <div class="card-top-row">
              <div style="display:flex;gap:12px;align-items:center;">
                <div class="card-icon-badge">🍏</div>
                <div>
                  <h3 class="card-title">iCloud Drive / File System Sync</h3>
                  <div class="card-meta">Native iOS/macOS iCloud Drive Folder & File Picker</div>
                </div>
              </div>
              <span class="zk-pill">iOS / macOS</span>
            </div>
            <p style="font-size:0.82rem;color:var(--text-secondary);margin-top:10px;">
              Saves and syncs <code>MasterVault_iCloud_Sync.mvault.json</code> directly with your iCloud Drive folder via Web File System API. Last synced: <strong>${escapeHtml(iSyncTime)}</strong>
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border-color);">
            <button id="btn-sync-icloud" class="btn btn-primary" style="flex:1;" data-action="sync-icloud-drive">
              🔄 Sync with iCloud Drive
            </button>
            <button class="btn btn-secondary" data-action="sync-icloud-file-picker">
              📂 Save to iCloud Folder…
            </button>
          </div>
        </div>
      </div>

      <!-- Full Backup Export / Import (JSON & AES-256-GCM Encrypted .mvault) -->
      <div class="form-panel">
        <h3 style="font-size:1rem;">📦 Full Backup Export / Import (JSON & Zero-Knowledge AES-256-GCM)</h3>
        <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">
          Export your entire vault as a portable JSON file or protect it with a client-side AES-256-GCM passphrase before saving to external storage.
        </p>

        <div class="form-grid" style="align-items:end;">
          <div class="field-group">
            <label>Optional AES-256-GCM Encryption Passphrase</label>
            <input id="backup-passphrase-input" type="password" class="field-input" placeholder="Leave empty for plain JSON backup" />
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="btn-export-backup" class="btn btn-amber" data-action="export-full-backup">
              ⬇️ Export Full Backup (.json / .mvault)
            </button>
            <label class="btn btn-secondary" style="cursor:pointer;">
              ⬆️ Import Backup File
              <input id="input-import-backup-file" type="file" accept=".json,.mvault" style="display:none;" />
            </label>
            <button class="btn btn-danger btn-sm" data-action="reset-demo-data">
              ♻️ Reset Starter Templates
            </button>
          </div>
        </div>
      </div>

      <!-- Cryptographic Sync & Storage Audit Log -->
      <div class="category-block">
        <div class="category-header">
          <span>Zero-Knowledge Sync & Storage Verification Log</span>
          <span>IndexedDB + Personal Cloud</span>
        </div>
        ${(s.syncLog || [])
          .map(
            (entry) => `
          <div class="item-row">
            <div>
              <div class="item-title-text">${escapeHtml(entry.provider)} · <span style="color:var(--success);">${escapeHtml(entry.status)}</span></div>
              <div class="item-sub-text">${escapeHtml(entry.details)}</div>
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted);">${new Date(entry.timestamp).toLocaleTimeString('en-IN')}</span>
          </div>`
          )
          .join('')}
      </div>
    </div>
  `;
}

// ============================================================================
// MAIN RENDER & EVENT DELEGATION
// ============================================================================
export function renderApp() {
  const state = vaultDB.state;
  const lang = state.settings.language || 'en';
  const theme = state.settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  const root = document.getElementById('app-root');
  if (!root) return;

  let mainViewHtml = '';
  if (uiState.activeTab === 'lists') {
    mainViewHtml = renderListsView(state, lang);
  } else if (uiState.activeTab === 'notes') {
    mainViewHtml = renderNotesView(state, lang);
  } else if (uiState.activeTab === 'cards') {
    mainViewHtml = renderCardsView(state, lang);
  } else if (uiState.activeTab === 'offers') {
    mainViewHtml = renderOffersView(state, lang);
  } else if (uiState.activeTab === 'sync') {
    mainViewHtml = renderSyncView(state, lang);
  }

  root.innerHTML = `
    <div class="app-shell">
      <header class="top-header">
        <div class="header-inner">
          <div class="brand-cluster">
            <img src="./assets/icon.svg" alt="MasterVault Logo" class="brand-logo" />
            <div class="brand-titles">
              <h1>
                ${escapeHtml(t(lang, 'appName'))}
                <span class="zk-pill">🔒 ${escapeHtml(t(lang, 'zeroKnowledgeBadge'))}</span>
              </h1>
              <div class="brand-subtitle">${escapeHtml(t(lang, 'appSubtitle'))}</div>
            </div>
          </div>

          <div class="header-controls">
            <button id="btn-toggle-lang" class="btn btn-secondary btn-sm" data-action="toggle-language">
              🌐 ${lang === 'en' ? 'हिंदी / EN' : 'English / हिं'}
            </button>
            <button id="btn-toggle-theme" class="btn btn-secondary btn-sm" data-action="toggle-theme">
              ${theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button id="btn-quick-cloud-sync" class="btn btn-primary btn-sm" data-action="sync-google-drive">
              ☁️ Quick Sync
            </button>
          </div>
        </div>

        <div class="global-search-row">
          <span class="search-icon-prefix">🔍</span>
          <input
            id="global-search-input"
            type="search"
            class="global-search-input"
            placeholder="${escapeHtml(t(lang, 'searchPlaceholder'))}"
            value="${escapeHtml(uiState.searchQuery)}"
          />
          ${
            uiState.searchQuery
              ? `<button class="search-clear-btn" data-action="clear-search" title="Clear search">✕</button>`
              : ''
          }
        </div>
      </header>

      <main id="main-view-container">
        ${mainViewHtml}
      </main>
    </div>

    <nav class="bottom-nav" aria-label="Primary Navigation">
      <div class="bottom-nav-inner">
        <button id="nav-btn-lists" class="nav-tab-btn ${uiState.activeTab === 'lists' ? 'active' : ''}" data-action="switch-tab" data-tab="lists">
          <span class="nav-icon">📋</span>
          <span class="nav-label">${escapeHtml(t(lang, 'navLists'))}</span>
        </button>
        <button id="nav-btn-notes" class="nav-tab-btn ${uiState.activeTab === 'notes' ? 'active' : ''}" data-action="switch-tab" data-tab="notes">
          <span class="nav-icon">📝</span>
          <span class="nav-label">${escapeHtml(t(lang, 'navNotes'))}</span>
        </button>
        <button id="nav-btn-cards" class="nav-tab-btn ${uiState.activeTab === 'cards' ? 'active' : ''}" data-action="switch-tab" data-tab="cards">
          <span class="nav-icon">🪪</span>
          <span class="nav-label">${escapeHtml(t(lang, 'navCards'))}</span>
        </button>
        <button id="nav-btn-offers" class="nav-tab-btn ${uiState.activeTab === 'offers' ? 'active' : ''}" data-action="switch-tab" data-tab="offers">
          <span class="nav-icon">🏷️</span>
          <span class="nav-label">${escapeHtml(t(lang, 'navOffers'))}</span>
        </button>
        <button id="nav-btn-sync" class="nav-tab-btn ${uiState.activeTab === 'sync' ? 'active' : ''}" data-action="switch-tab" data-tab="sync">
          <span class="nav-icon">☁️</span>
          <span class="nav-label">${escapeHtml(t(lang, 'navSync'))}</span>
        </button>
      </div>
    </nav>
  `;

  bindDynamicInputs();
}

function formatListForSharing(al) {
  const totalCost = al.items.reduce((s, i) => s + (Number(i.estimatedPrice) || 0), 0);
  const lines = [
    `*${al.icon || '🛒'} ${al.title}*`,
    `Generated via MasterVault (NijKosh)`,
    `--------------------------------`
  ];
  const grouped = groupByCategory(al.items);
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`\n*${cat.toUpperCase()}*`);
    for (const it of items) {
      lines.push(`${it.checked ? '✅' : '⬜'} ${it.name} — *${it.qty} ${it.unit}* ${it.brand ? `(${it.brand})` : ''}`);
    }
  }
  lines.push(`\n*Estimated Total:* ${formatINR(totalCost)}`);
  return lines.join('\n');
}

function bindDynamicInputs() {
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      uiState.searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      renderApp();
      const nextInput = document.getElementById('global-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    });
  }

  const wizardTitleInput = document.getElementById('wizard-list-title-input');
  if (wizardTitleInput) {
    wizardTitleInput.addEventListener('input', (e) => {
      uiState.wizardListTitle = e.target.value;
    });
  }

  const cardUpload = document.getElementById('input-card-image-upload');
  if (cardUpload) {
    cardUpload.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        uiState.cardDraft.frontImage = dataUrl;
        renderApp();
        const ocrRes = await runImageOCR(dataUrl, (pct, msg) => {
          uiState.ocrProgress = pct;
          uiState.ocrStatusText = msg;
          renderApp();
        });
        if (ocrRes.rawText) {
          uiState.cardDraft.rawOcrText = ocrRes.rawText;
          Object.assign(uiState.cardDraft, ocrRes.fields, {
            tagsText: (ocrRes.fields.tags || []).join(', ')
          });
        }
        renderApp();
        showToast('Card image loaded! Review extracted fields below.');
      };
      reader.readAsDataURL(file);
    });
  }

  const backupUpload = document.getElementById('input-import-backup-file');
  if (backupUpload) {
    backupUpload.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          let parsed = JSON.parse(reader.result);
          if (parsed.encrypted) {
            const passInput = document.getElementById('backup-passphrase-input');
            const pass = passInput?.value || prompt('Enter decryption passphrase for this .mvault backup:') || '';
            parsed = await decryptVaultPayload(parsed, pass);
          }
          await vaultDB.importFullVaultPayload(parsed);
          renderApp();
          showToast('Full Vault Backup restored successfully!');
        } catch (err) {
          showToast('Restore failed: ' + (err.message || 'Invalid file or passphrase'));
        }
      };
      reader.readAsText(file);
    });
  }
}

function stopCameraIfRunning() {
  if (uiState.cameraStream) {
    uiState.cameraStream.getTracks().forEach((t) => t.stop());
    uiState.cameraStream = null;
  }
}

// Global Click, Change & Submit Delegation
function attachGlobalListeners() {
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');

    if (action === 'switch-tab') {
      stopCameraIfRunning();
      uiState.activeTab = target.getAttribute('data-tab');
      if (uiState.activeTab === 'lists' && uiState.listsSubView === 'wizard') {
        uiState.listsSubView = 'active';
      }
      renderApp();
    } else if (action === 'toggle-language') {
      const nextLang = vaultDB.state.settings.language === 'en' ? 'hi' : 'en';
      await vaultDB.updateSettings({ language: nextLang });
      renderApp();
      showToast(nextLang === 'hi' ? 'भाषा बदली गई: हिंदी + Hinglish' : 'Language switched to English');
    } else if (action === 'toggle-theme') {
      const nextTheme = vaultDB.state.settings.theme === 'dark' ? 'light' : 'dark';
      await vaultDB.updateSettings({ theme: nextTheme });
      renderApp();
    } else if (action === 'clear-search') {
      uiState.searchQuery = '';
      renderApp();
    } else if (action === 'switch-lists-subview') {
      uiState.listsSubView = target.getAttribute('data-subview');
      renderApp();
    } else if (action === 'toggle-new-master-modal') {
      uiState.showNewMasterModal = !uiState.showNewMasterModal;
      renderApp();
    } else if (action === 'open-master-detail') {
      uiState.selectedMasterId = target.getAttribute('data-master-id');
      uiState.listsSubView = 'masterDetail';
      renderApp();
    } else if (action === 'delete-master-item') {
      const masterId = target.getAttribute('data-master-id');
      const itemId = target.getAttribute('data-item-id');
      await vaultDB.removeMasterItem(masterId, itemId);
      renderApp();
      showToast('Item removed from Master Blueprint');
    } else if (action === 'open-wizard') {
      const masterId = target.getAttribute('data-master-id');
      openWizardForMasterList(masterId);
    } else if (action === 'wizard-toggle-item') {
      const itemId = target.getAttribute('data-item-id');
      if (uiState.wizardSelections[itemId]) {
        uiState.wizardSelections[itemId].selected = !uiState.wizardSelections[itemId].selected;
        renderApp();
      }
    } else if (action === 'wizard-select-all') {
      const flag = target.getAttribute('data-select') === 'true';
      Object.values(uiState.wizardSelections).forEach((item) => {
        item.selected = flag;
      });
      renderApp();
    } else if (action === 'wizard-remove-custom') {
      const idx = Number(target.getAttribute('data-idx'));
      uiState.wizardCustomItems.splice(idx, 1);
      renderApp();
    } else if (action === 'confirm-create-active-list') {
      const selected = Object.values(uiState.wizardSelections).filter((i) => i.selected);
      const allChosen = [...selected, ...uiState.wizardCustomItems];
      if (allChosen.length === 0) {
        showToast('Please tick at least 1 item to generate an Active List.');
        return;
      }
      const customToSave = uiState.wizardCustomItems.filter((c) => c.saveToMaster);
      const created = await vaultDB.createActiveList({
        title: uiState.wizardListTitle || 'New Active List',
        masterListId: uiState.wizardMasterId,
        selectedItems: allChosen,
        customItemsToSaveToMaster: customToSave
      });
      uiState.selectedActiveId = created.id;
      uiState.offersListId = created.id;
      uiState.listsSubView = 'execute';
      renderApp();
      showToast(`Created "${created.title}" with ${created.items.length} items!`);
    } else if (action === 'open-active-execution') {
      uiState.activeTab = 'lists';
      uiState.selectedActiveId = target.getAttribute('data-active-id');
      uiState.listsSubView = 'execute';
      renderApp();
    } else if (action === 'toggle-active-item') {
      const activeId = target.getAttribute('data-active-id');
      const itemId = target.getAttribute('data-item-id');
      await vaultDB.toggleActiveItem(activeId, itemId);
      renderApp();
    } else if (action === 'delete-active-list') {
      const activeId = target.getAttribute('data-active-id');
      await vaultDB.deleteActiveList(activeId);
      renderApp();
      showToast('Active List deleted');
    } else if (action === 'jump-to-offers') {
      uiState.offersListId = target.getAttribute('data-active-id');
      uiState.activeTab = 'offers';
      renderApp();
    } else if (action === 'share-list-whatsapp') {
      const activeId = target.getAttribute('data-active-id');
      const al = vaultDB.state.activeLists.find((l) => l.id === activeId);
      if (al) {
        const text = formatListForSharing(al);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      }
    } else if (action === 'copy-list-text') {
      const activeId = target.getAttribute('data-active-id');
      const al = vaultDB.state.activeLists.find((l) => l.id === activeId);
      if (al) {
        const text = formatListForSharing(al);
        navigator.clipboard?.writeText(text);
        showToast('Checklist copied to clipboard for WhatsApp / Notes!');
      }
    } else if (action === 'open-note-editor') {
      uiState.editingNote = {
        id: '',
        title: '',
        content: '### Key Points\n- [ ] First action item\n- [ ] Second item',
        tags: ['Personal'],
        color: 'teal',
        pinned: false,
        linkedListId: '',
        linkedCardId: ''
      };
      renderApp();
    } else if (action === 'close-note-editor') {
      uiState.editingNote = null;
      renderApp();
    } else if (action === 'edit-note') {
      const noteId = target.getAttribute('data-note-id');
      const found = vaultDB.state.notes.find((n) => n.id === noteId);
      if (found) {
        uiState.editingNote = structuredClone(found);
        renderApp();
      }
    } else if (action === 'toggle-pin-note') {
      const noteId = target.getAttribute('data-note-id');
      await vaultDB.togglePinNote(noteId);
      renderApp();
    } else if (action === 'delete-note') {
      const noteId = target.getAttribute('data-note-id');
      await vaultDB.deleteNote(noteId);
      renderApp();
      showToast('Note deleted');
    } else if (action === 'filter-note-tag') {
      uiState.noteTagFilter = target.getAttribute('data-tag');
      renderApp();
    } else if (action === 'insert-note-checklist-template') {
      const contentEl = document.getElementById('note-editor-content');
      if (contentEl) {
        contentEl.value += '\n- [ ] New checklist item';
      }
    } else if (action === 'toggle-note-check') {
      const noteId = target.getAttribute('data-note-id');
      const lineIdx = Number(target.getAttribute('data-line-idx'));
      const note = vaultDB.state.notes.find((n) => n.id === noteId);
      if (note) {
        const lines = note.content.split('\n');
        if (lines[lineIdx]) {
          if (/^- \[x\] /i.test(lines[lineIdx].trim())) {
            lines[lineIdx] = lines[lineIdx].replace(/\[x\]/i, '[ ]');
          } else {
            lines[lineIdx] = lines[lineIdx].replace(/\[ \]/, '[x]');
          }
          await vaultDB.saveNote({ ...note, content: lines.join('\n') });
          renderApp();
        }
      }
    } else if (action === 'open-linked-note') {
      uiState.activeTab = 'notes';
      uiState.noteTagFilter = 'ALL';
      renderApp();
    } else if (action === 'jump-to-card') {
      const cardId = target.getAttribute('data-card-id');
      uiState.activeTab = 'cards';
      uiState.cardFilterCategory = 'ALL';
      renderApp();
      setTimeout(() => {
        document.getElementById(`vault-card-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    } else if (action === 'start-voice-note') {
      handleVoiceCapture();
    } else if (action === 'toggle-card-scanner') {
      stopCameraIfRunning();
      uiState.showCardScannerPanel = !uiState.showCardScannerPanel;
      if (uiState.showCardScannerPanel && !uiState.cardDraft.fullName) {
        // Pre-load first demo card so user sees immediate rich fields
        const demo = SAMPLE_DEMO_CARDS[0];
        const imgUrl = renderDemoCardToDataUrl(demo);
        const extracted = extractStructuredContactFromText(demo.rawText);
        uiState.cardDraft = {
          id: '',
          ...extracted,
          tagsText: (extracted.tags || []).join(', '),
          notes: '',
          frontImage: imgUrl,
          rawOcrText: demo.rawText
        };
      }
      renderApp();
    } else if (action === 'scan-demo-card') {
      const demoId = target.getAttribute('data-demo-id');
      const demo = SAMPLE_DEMO_CARDS.find((d) => d.id === demoId) || SAMPLE_DEMO_CARDS[0];
      const imgUrl = renderDemoCardToDataUrl(demo);
      uiState.cardDraft.frontImage = imgUrl;
      const res = await runImageOCR(imgUrl, (pct, msg) => {
        uiState.ocrProgress = pct;
        uiState.ocrStatusText = msg;
        renderApp();
      });
      uiState.cardDraft = {
        id: '',
        ...res.fields,
        tagsText: (res.fields.tags || []).join(', '),
        notes: '',
        frontImage: imgUrl,
        rawOcrText: demo.rawText
      };
      renderApp();
      showToast(`OCR Extracted: ${res.fields.fullName} (${res.fields.company})`);
    } else if (action === 'reparse-ocr-text') {
      const rawEl = document.getElementById('ocr-raw-textarea');
      const rawText = rawEl ? rawEl.value : uiState.cardDraft.rawOcrText;
      const extracted = extractStructuredContactFromText(rawText);
      uiState.cardDraft = {
        ...uiState.cardDraft,
        ...extracted,
        tagsText: (extracted.tags || []).join(', '),
        rawOcrText: rawText
      };
      renderApp();
      showToast('Smart NLP Field Extraction updated!');
    } else if (action === 'start-camera-capture') {
      try {
        const box = document.getElementById('camera-preview-box');
        const video = document.getElementById('camera-video-el');
        if (box && video && navigator.mediaDevices?.getUserMedia) {
          box.style.display = 'block';
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          uiState.cameraStream = stream;
          video.srcObject = stream;
        } else {
          showToast('Camera API unavailable in this browser context; use Upload or Demo Card.');
        }
      } catch {
        showToast('Camera permission denied or no webcam found. Try Upload or Demo Card!');
      }
    } else if (action === 'capture-camera-frame') {
      const video = document.getElementById('camera-video-el');
      if (video && uiState.cameraStream) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        stopCameraIfRunning();
        uiState.cardDraft.frontImage = dataUrl;
        await runImageOCR(dataUrl, (pct, msg) => {
          uiState.ocrProgress = pct;
          uiState.ocrStatusText = msg;
          renderApp();
        });
        renderApp();
        showToast('Camera frame captured! Verify extracted details.');
      }
    } else if (action === 'stop-camera-capture') {
      stopCameraIfRunning();
      const box = document.getElementById('camera-preview-box');
      if (box) box.style.display = 'none';
    } else if (action === 'filter-card-category') {
      uiState.cardFilterCategory = target.getAttribute('data-category');
      renderApp();
    } else if (action === 'export-vcf') {
      const cardId = target.getAttribute('data-card-id');
      const card = vaultDB.state.cards.find((c) => c.id === cardId);
      if (card) {
        downloadVCard(card);
        showToast(`Downloaded ${card.fullName}.vcf for Phone Contacts!`);
      }
    } else if (action === 'delete-card') {
      const cardId = target.getAttribute('data-card-id');
      await vaultDB.deleteCard(cardId);
      renderApp();
      showToast('Contact card removed from vault');
    } else if (action === 'sync-google-drive') {
      try {
        const tokenInput = document.getElementById('input-google-token');
        const accessToken = tokenInput ? tokenInput.value.trim() : '';
        const res = await syncWithGoogleDrive(vaultDB, { accessToken });
        renderApp();
        showToast(`Synced with Google Drive (${res.sizeKb} KB · SHA-256 verified)`);
      } catch (err) {
        showToast('Google Drive Sync error: ' + err.message);
      }
    } else if (action === 'sync-icloud-drive') {
      const res = await syncWithICloudDrive(vaultDB, { triggerFileSave: false });
      renderApp();
      showToast(`Synced with iCloud Drive (${res.sizeKb} KB · SHA-256 verified)`);
    } else if (action === 'sync-icloud-file-picker') {
      const res = await syncWithICloudDrive(vaultDB, { triggerFileSave: true });
      renderApp();
      showToast(`Saved iCloud Sync File (${res.sizeKb} KB)`);
    } else if (action === 'restore-cloud-snapshot') {
      try {
        const snap = await restoreFromCloudSnapshot(vaultDB);
        renderApp();
        showToast(`Restored snapshot from ${snap.provider}!`);
      } catch (err) {
        showToast(err.message);
      }
    } else if (action === 'export-full-backup') {
      const passInput = document.getElementById('backup-passphrase-input');
      const passphrase = passInput ? passInput.value : '';
      await downloadFullBackupFile(vaultDB, passphrase);
      renderApp();
      showToast(passphrase ? 'Exported AES-256-GCM Encrypted Backup!' : 'Exported Full JSON Backup!');
    } else if (action === 'reset-demo-data') {
      await vaultDB.resetToStarterDefaults();
      renderApp();
      showToast('Starter templates (Indian Grocery, Travel, Festival & Home) restored!');
    }
  });

  // Handle inline quantity, unit & price changes
  document.addEventListener('change', async (e) => {
    const target = e.target;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'wizard-change-qty') {
      const id = target.getAttribute('data-item-id');
      if (uiState.wizardSelections[id]) {
        const oldQty = uiState.wizardSelections[id].qty || 1;
        const newQty = Math.max(0.1, Number(target.value) || 1);
        const unitPrice = (uiState.wizardSelections[id].estimatedPrice || 0) / oldQty;
        uiState.wizardSelections[id].qty = newQty;
        uiState.wizardSelections[id].estimatedPrice = Math.round(unitPrice * newQty);
        uiState.wizardSelections[id].selected = true;
        renderApp();
      }
    } else if (action === 'wizard-change-unit') {
      const id = target.getAttribute('data-item-id');
      if (uiState.wizardSelections[id]) {
        uiState.wizardSelections[id].unit = target.value;
        renderApp();
      }
    } else if (action === 'wizard-change-price') {
      const id = target.getAttribute('data-item-id');
      if (uiState.wizardSelections[id]) {
        uiState.wizardSelections[id].estimatedPrice = Math.max(0, Number(target.value) || 0);
        renderApp();
      }
    } else if (action === 'active-change-qty') {
      const activeId = target.getAttribute('data-active-id');
      const itemId = target.getAttribute('data-item-id');
      const list = vaultDB.state.activeLists.find((l) => l.id === activeId);
      const item = list?.items.find((i) => i.id === itemId);
      if (item) {
        const oldQty = item.qty || 1;
        const newQty = Math.max(0.1, Number(target.value) || 1);
        const newEst = Math.round(((item.estimatedPrice || 0) / oldQty) * newQty);
        await vaultDB.updateActiveItemQty(activeId, itemId, newQty, item.unit, newEst);
        renderApp();
      }
    } else if (action === 'change-offers-list') {
      uiState.offersListId = target.value;
      renderApp();
    }
  });

  // Handle Form Submissions
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    e.preventDefault();

    if (form.id === 'form-create-master') {
      const fd = new FormData(form);
      const created = await vaultDB.createMasterList({
        title: fd.get('title'),
        category: fd.get('category'),
        icon: fd.get('icon'),
        description: fd.get('description')
      });
      uiState.showNewMasterModal = false;
      uiState.selectedMasterId = created.id;
      uiState.listsSubView = 'masterDetail';
      renderApp();
      showToast(`Created Master Blueprint "${created.title}"`);
    } else if (form.id === 'form-add-master-item') {
      const masterId = form.getAttribute('data-master-id');
      const fd = new FormData(form);
      await vaultDB.addMasterItem(masterId, {
        name: fd.get('name'),
        category: fd.get('category'),
        defaultQty: fd.get('defaultQty'),
        defaultUnit: fd.get('defaultUnit'),
        brand: fd.get('brand'),
        estimatedPrice: fd.get('estimatedPrice')
      });
      renderApp();
      showToast('Added item to Master Blueprint!');
    } else if (form.id === 'form-wizard-add-custom') {
      const fd = new FormData(form);
      uiState.wizardCustomItems.push({
        name: fd.get('name'),
        category: fd.get('category') || 'Custom',
        qty: Number(fd.get('qty')) || 1,
        unit: fd.get('unit') || 'pcs',
        brand: fd.get('brand') || '',
        estimatedPrice: Number(fd.get('estimatedPrice')) || 0,
        saveToMaster: fd.get('saveToMaster') === 'on'
      });
      renderApp();
      showToast('Custom item added to wizard selection');
    } else if (form.id === 'form-active-quick-add') {
      const activeId = form.getAttribute('data-active-id');
      const fd = new FormData(form);
      await vaultDB.addActiveListItem(
        activeId,
        {
          name: fd.get('name'),
          category: fd.get('category'),
          qty: fd.get('qty'),
          unit: fd.get('unit'),
          estimatedPrice: fd.get('estimatedPrice')
        },
        fd.get('saveToMaster') === 'on'
      );
      renderApp();
      showToast('Item added to Active List!');
    } else if (form.id === 'form-save-note') {
      const fd = new FormData(form);
      const tags = String(fd.get('tags') || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await vaultDB.saveNote({
        id: fd.get('id') || '',
        title: fd.get('title'),
        content: fd.get('content'),
        color: fd.get('color'),
        tags,
        pinned: fd.get('pinned') === 'on',
        linkedListId: fd.get('linkedListId'),
        linkedCardId: fd.get('linkedCardId')
      });
      uiState.editingNote = null;
      renderApp();
      showToast('Note saved to local vault!');
    } else if (form.id === 'form-save-scanned-card') {
      const fd = new FormData(form);
      const tags = String(fd.get('tagsText') || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const saved = await vaultDB.saveCard({
        fullName: fd.get('fullName'),
        designation: fd.get('designation'),
        company: fd.get('company'),
        category: fd.get('category'),
        phone: fd.get('phone'),
        email: fd.get('email'),
        website: fd.get('website'),
        address: fd.get('address'),
        tags,
        frontImage: uiState.cardDraft.frontImage
      });
      uiState.showCardScannerPanel = false;
      renderApp();
      showToast(`Saved ${saved.fullName} to Contact Vault!`);
    }
  });
}

// Voice-to-Text Quick Note Capture (Web Speech API + Smart Fallback)
function handleVoiceCapture() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    // Open editor with quick voice-dictated sample if browser environment lacks hardware mic API
    uiState.editingNote = {
      id: '',
      title: 'Voice Note · Quick Capture (' + new Date().toLocaleTimeString('en-IN') + ')',
      content:
        '### Dictated Quick Note\n- [ ] Order 5kg Aashirvaad Atta & 1L Cold Pressed Mustard Oil\n- [ ] Call Suresh Khandelwal for dry fruit gift boxes before Friday',
      tags: ['VoiceCapture', 'QuickNote'],
      color: 'amber',
      pinned: true,
      linkedListId: vaultDB.state.activeLists[0]?.id || '',
      linkedCardId: vaultDB.state.cards[0]?.id || ''
    };
    renderApp();
    showToast('Voice dictation template ready — edit or save below!');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = vaultDB.state.settings.language === 'hi' ? 'hi-IN' : 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  uiState.isRecordingVoice = true;
  renderApp();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    uiState.isRecordingVoice = false;
    uiState.editingNote = {
      id: '',
      title: 'Voice Note: ' + transcript.slice(0, 36),
      content: `### Voice Transcript\n${transcript}\n\n- [ ] Follow up`,
      tags: ['VoiceNote'],
      color: 'teal',
      pinned: false,
      linkedListId: '',
      linkedCardId: ''
    };
    renderApp();
    showToast('Voice captured! Review & save note.');
  };

  recognition.onerror = () => {
    uiState.isRecordingVoice = false;
    renderApp();
    showToast('Microphone access unavailable — opening Quick Note editor.');
  };

  recognition.onend = () => {
    uiState.isRecordingVoice = false;
    renderApp();
  };

  recognition.start();
}

// Bootstrap Application
async function bootstrap() {
  await vaultDB.init();
  attachGlobalListeners();
  renderApp();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

bootstrap();
