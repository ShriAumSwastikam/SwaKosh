import {
  STARTER_MASTER_LISTS,
  STARTER_ACTIVE_LISTS,
  STARTER_NOTES,
  STARTER_CARDS
} from '../data/starterTemplates.js';

const DB_NAME = 'MasterVault_NijKosh_IDB';
const DB_VERSION = 1;
const STORE_NAME = 'vault_collections';
const LS_FALLBACK_KEY = 'mastervault_nijkosh_snapshot_v1';

class VaultDatabase {
  constructor() {
    this.db = null;
    this.state = {
      masterLists: [],
      activeLists: [],
      notes: [],
      cards: [],
      settings: {
        theme: 'dark',
        language: 'en',
        userName: 'Personal Vault',
        encryptionEnabled: false,
        googleClientId: '',
        googleDriveLastSync: null,
        iCloudLastSync: null,
        googleConnectedEmail: '',
        syncLog: [
          {
            id: 'log-init',
            timestamp: new Date().toISOString(),
            provider: 'IndexedDB Local Vault',
            status: 'Verified',
            details: 'Zero-knowledge local database initialized with starter templates.'
          }
        ]
      }
    };
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }

  async openIDB() {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined') return null;

    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = () => resolve(null);
    });
  }

  async init() {
    const db = await this.openIDB();
    let loaded = null;

    if (db) {
      loaded = await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get('root_state');
          getReq.onsuccess = () => resolve(getReq.result ? getReq.result.value : null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }

    if (!loaded) {
      try {
        const raw = localStorage.getItem(LS_FALLBACK_KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch {
        loaded = null;
      }
    }

    if (loaded && Array.isArray(loaded.masterLists) && loaded.masterLists.length > 0) {
      this.state = {
        ...this.state,
        ...loaded,
        settings: { ...this.state.settings, ...(loaded.settings || {}) }
      };
    } else {
      // Seed starter templates
      this.state.masterLists = structuredClone(STARTER_MASTER_LISTS);
      this.state.activeLists = structuredClone(STARTER_ACTIVE_LISTS);
      this.state.notes = structuredClone(STARTER_NOTES);
      this.state.cards = structuredClone(STARTER_CARDS);
      await this.persist();
    }

    this.notify();
    return this.state;
  }

  async persist() {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore quota errors on fallback
    }

    const db = await this.openIDB();
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({
            key: 'root_state',
            updatedAt: new Date().toISOString(),
            value: this.state
          });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }
    this.notify();
  }

  async updateSettings(partial) {
    this.state.settings = { ...this.state.settings, ...partial };
    await this.persist();
  }

  async addSyncLog(provider, status, details) {
    const entry = {
      id: 'sync-' + Date.now(),
      timestamp: new Date().toISOString(),
      provider,
      status,
      details
    };
    this.state.settings.syncLog = [entry, ...(this.state.settings.syncLog || []).slice(0, 19)];
    await this.persist();
    return entry;
  }

  // --- MASTER LISTS ---
  async createMasterList({ title, category, icon, description, items = [] }) {
    const newMaster = {
      id: 'ml-' + Date.now(),
      title: title.trim(),
      category: category || 'General',
      icon: icon || '📋',
      description: description || 'Custom reusable master blueprint.',
      updatedAt: new Date().toISOString(),
      items
    };
    this.state.masterLists.unshift(newMaster);
    await this.persist();
    return newMaster;
  }

  async deleteMasterList(masterId) {
    this.state.masterLists = this.state.masterLists.filter((m) => m.id !== masterId);
    await this.persist();
  }

  async addMasterItem(masterId, item) {
    const ml = this.state.masterLists.find((m) => m.id === masterId);
    if (!ml) return null;
    const newItem = {
      id: 'mi-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: item.name.trim(),
      category: item.category || 'General',
      defaultQty: Number(item.defaultQty) || 1,
      defaultUnit: item.defaultUnit || 'pcs',
      brand: item.brand || '',
      estimatedPrice: Number(item.estimatedPrice) || 0
    };
    ml.items.push(newItem);
    ml.updatedAt = new Date().toISOString();
    await this.persist();
    return newItem;
  }

  async updateMasterItem(masterId, itemId, updates) {
    const ml = this.state.masterLists.find((m) => m.id === masterId);
    if (!ml) return;
    const idx = ml.items.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      ml.items[idx] = { ...ml.items[idx], ...updates };
      ml.updatedAt = new Date().toISOString();
      await this.persist();
    }
  }

  async removeMasterItem(masterId, itemId) {
    const ml = this.state.masterLists.find((m) => m.id === masterId);
    if (!ml) return;
    ml.items = ml.items.filter((i) => i.id !== itemId);
    ml.updatedAt = new Date().toISOString();
    await this.persist();
  }

  // --- ACTIVE SUB-LISTS ---
  async createActiveList({ title, masterListId, selectedItems, customItemsToSaveToMaster = [] }) {
    const master = this.state.masterLists.find((m) => m.id === masterListId);

    // Save optional custom items back to Master List if user ticked "Also save to Master List"
    if (master && customItemsToSaveToMaster.length > 0) {
      for (const cItem of customItemsToSaveToMaster) {
        master.items.push({
          id: 'mi-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          name: cItem.name,
          category: cItem.category || 'Custom',
          defaultQty: Number(cItem.qty) || 1,
          defaultUnit: cItem.unit || 'pcs',
          brand: cItem.brand || '',
          estimatedPrice: Number(cItem.estimatedPrice) || 0
        });
      }
      master.updatedAt = new Date().toISOString();
    }

    const newActive = {
      id: 'al-' + Date.now(),
      title: title.trim(),
      masterListId: master ? master.id : 'custom',
      masterListTitle: master ? master.title : 'Custom List',
      category: master ? master.category : 'General',
      icon: master ? master.icon : '✅',
      createdAt: new Date().toISOString(),
      items: selectedItems.map((it, idx) => ({
        id: 'ai-' + Date.now() + '-' + idx,
        masterItemId: it.masterItemId || null,
        name: it.name,
        category: it.category || 'General',
        qty: Number(it.qty) || 1,
        unit: it.unit || 'pcs',
        brand: it.brand || '',
        estimatedPrice: Number(it.estimatedPrice) || 0,
        checked: Boolean(it.checked)
      }))
    };

    this.state.activeLists.unshift(newActive);
    await this.persist();
    return newActive;
  }

  async toggleActiveItem(activeListId, itemId) {
    const list = this.state.activeLists.find((l) => l.id === activeListId);
    if (!list) return;
    const item = list.items.find((i) => i.id === itemId);
    if (item) {
      item.checked = !item.checked;
      await this.persist();
    }
  }

  async updateActiveItemQty(activeListId, itemId, qty, unit, estimatedPrice) {
    const list = this.state.activeLists.find((l) => l.id === activeListId);
    if (!list) return;
    const item = list.items.find((i) => i.id === itemId);
    if (item) {
      if (qty !== undefined) item.qty = Math.max(0.1, Number(qty) || 1);
      if (unit !== undefined) item.unit = unit;
      if (estimatedPrice !== undefined) item.estimatedPrice = Math.max(0, Number(estimatedPrice) || 0);
      await this.persist();
    }
  }

  async addActiveListItem(activeListId, newItem, saveToMaster = false) {
    const list = this.state.activeLists.find((l) => l.id === activeListId);
    if (!list) return;
    const entry = {
      id: 'ai-' + Date.now(),
      masterItemId: null,
      name: newItem.name.trim(),
      category: newItem.category || 'Custom Added',
      qty: Number(newItem.qty) || 1,
      unit: newItem.unit || 'pcs',
      brand: newItem.brand || '',
      estimatedPrice: Number(newItem.estimatedPrice) || 0,
      checked: false
    };
    list.items.push(entry);

    if (saveToMaster && list.masterListId) {
      await this.addMasterItem(list.masterListId, {
        name: entry.name,
        category: entry.category,
        defaultQty: entry.qty,
        defaultUnit: entry.unit,
        brand: entry.brand,
        estimatedPrice: entry.estimatedPrice
      });
    } else {
      await this.persist();
    }
    return entry;
  }

  async deleteActiveList(activeListId) {
    this.state.activeLists = this.state.activeLists.filter((l) => l.id !== activeListId);
    await this.persist();
  }

  // --- NOTES ---
  async saveNote(noteData) {
    if (noteData.id) {
      const idx = this.state.notes.findIndex((n) => n.id === noteData.id);
      if (idx !== -1) {
        this.state.notes[idx] = {
          ...this.state.notes[idx],
          ...noteData,
          updatedAt: new Date().toISOString()
        };
        await this.persist();
        return this.state.notes[idx];
      }
    }
    const created = {
      id: 'note-' + Date.now(),
      title: (noteData.title || 'Untitled Note').trim(),
      content: noteData.content || '',
      tags: Array.isArray(noteData.tags) ? noteData.tags : [],
      color: noteData.color || 'teal',
      pinned: Boolean(noteData.pinned),
      linkedListId: noteData.linkedListId || '',
      linkedCardId: noteData.linkedCardId || '',
      updatedAt: new Date().toISOString()
    };
    this.state.notes.unshift(created);
    await this.persist();
    return created;
  }

  async togglePinNote(noteId) {
    const note = this.state.notes.find((n) => n.id === noteId);
    if (note) {
      note.pinned = !note.pinned;
      note.updatedAt = new Date().toISOString();
      await this.persist();
    }
  }

  async deleteNote(noteId) {
    this.state.notes = this.state.notes.filter((n) => n.id !== noteId);
    await this.persist();
  }

  // --- VISITING CARDS ---
  async saveCard(cardData) {
    if (cardData.id) {
      const idx = this.state.cards.findIndex((c) => c.id === cardData.id);
      if (idx !== -1) {
        this.state.cards[idx] = { ...this.state.cards[idx], ...cardData };
        await this.persist();
        return this.state.cards[idx];
      }
    }
    const created = {
      id: 'card-' + Date.now(),
      fullName: (cardData.fullName || 'Unknown Contact').trim(),
      designation: (cardData.designation || '').trim(),
      company: (cardData.company || '').trim(),
      phone: (cardData.phone || '').trim(),
      altPhone: (cardData.altPhone || '').trim(),
      email: (cardData.email || '').trim(),
      website: (cardData.website || '').trim(),
      address: (cardData.address || '').trim(),
      category: cardData.category || 'Business',
      tags: Array.isArray(cardData.tags) ? cardData.tags : [],
      notes: cardData.notes || '',
      frontImage: cardData.frontImage || '',
      backImage: cardData.backImage || '',
      createdAt: new Date().toISOString()
    };
    this.state.cards.unshift(created);
    await this.persist();
    return created;
  }

  async deleteCard(cardId) {
    this.state.cards = this.state.cards.filter((c) => c.id !== cardId);
    await this.persist();
  }

  // --- FULL EXPORT / IMPORT / RESET ---
  exportFullVaultPayload() {
    return {
      app: 'MasterVault (NijKosh)',
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      zeroKnowledgeArchitecture: true,
      counts: {
        masterLists: this.state.masterLists.length,
        activeLists: this.state.activeLists.length,
        notes: this.state.notes.length,
        cards: this.state.cards.length
      },
      data: this.state
    };
  }

  async importFullVaultPayload(payload) {
    const data = payload && payload.data ? payload.data : payload;
    if (!data || !Array.isArray(data.masterLists)) {
      throw new Error('Invalid MasterVault backup file structure.');
    }
    this.state = {
      masterLists: data.masterLists || [],
      activeLists: data.activeLists || [],
      notes: data.notes || [],
      cards: data.cards || [],
      settings: {
        ...this.state.settings,
        ...(data.settings || {})
      }
    };
    await this.addSyncLog('Vault Restore', 'Success', `Imported ${this.state.masterLists.length} Master Lists, ${this.state.activeLists.length} Active Lists, ${this.state.notes.length} Notes, ${this.state.cards.length} Cards.`);
    await this.persist();
    return this.state;
  }

  async resetToStarterDefaults() {
    this.state.masterLists = structuredClone(STARTER_MASTER_LISTS);
    this.state.activeLists = structuredClone(STARTER_ACTIVE_LISTS);
    this.state.notes = structuredClone(STARTER_NOTES);
    this.state.cards = structuredClone(STARTER_CARDS);
    await this.addSyncLog('Factory Reset', 'Success', 'Restored default Indian Grocery, Travel, Festival & Home Master Lists.');
    await this.persist();
  }
}

export const vaultDB = new VaultDatabase();
