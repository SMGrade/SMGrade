/**
 * SMGrade Arcade Standalone In-Game Overlay & User Controls
 * Clean standalone integration with:
 * - Username-Only Entry Screen (Phase 5)
 * - In-Inventory Add Item with Level and Enchantment configuration (Phase 6 & 9)
 * - In-Pet-Inventory Add Pet (Phase 7)
 * - Mine World Add Ore (Phase 8)
 * - Compact HUD Resource Controls for Gold, Power, and Level (Phase 10)
 * - Removed Old Floating Top Dock (Phase 13)
 * - Zero external server connections (Phase 14)
 * - Local persistence (Phase 15)
 */

(function () {
  console.log('[SMGrade Arcade Overlay] Initializing standalone local overlay & in-game controls...');

  // State
  let activeTab = 'swords'; // 'swords' | 'shields'
  let selectedItem = null;
  let selectedPet = null;
  let selectedLevel = 1;
  let currentRarityFilter = 'all';

  // Enchantment selections for Item Forge
  const selectedEnchants = {
    flame: 0,
    looting: 0,
    freeze: 0,
    thorns: 0,
    fortune: 0
  };

  // Toast Notification System
  function showToast(message, icon = '⚔️') {
    let container = document.getElementById('smgrade-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'smgrade-toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'smgrade-toast';
    toast.innerHTML = `<span style="font-size: 18px;">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px) scale(0.95)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
  window.showToast = showToast;

  // Pointer Lock handling for modals
  function lockMouseForModal(isOpen) {
    if (isOpen) {
      if (document.exitPointerLock) document.exitPointerLock();
      if (window.pcApp) {
        window.pcApp.isCustomModalOpen = true;
        window.pcApp.isInventoryEnabled = true;
        window.pcApp.cameraStateLocked = false;
      }
    } else {
      if (window.pcApp) {
        window.pcApp.isCustomModalOpen = false;
        window.pcApp.isInventoryEnabled = false;
      }
    }
  }

  // Intercept and prevent game engine from trapping scroll or pointer lock in modals
  if (typeof window !== 'undefined') {
    // Wheel event capture: stops game engine e.preventDefault() from trapping modal scrolling
    window.addEventListener('wheel', (e) => {
      const modalScrollTarget = e.target.closest('.smgrade-grid, .smgrade-modal-dialog, .smgrade-modal-overlay, .smgrade-enchants-content');
      if (modalScrollTarget) {
        e.stopImmediatePropagation();
      }
    }, { capture: true, passive: false });

    // Stop keyboard input propagation when user types in search or inputs
    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      window.addEventListener(evt, (e) => {
        if (e.target.matches('input, select, textarea') || e.target.closest('.smgrade-modal-overlay.active')) {
          e.stopPropagation();
        }
      }, { capture: true });
    });
  }

  // --- 1. COMPACT HUD '+' CONTROLS (Requirement 6 & 7) ---
  function createHudControls() {
    let hud = document.getElementById('smgrade-compact-hud-controls');
    if (hud) return;

    hud = document.createElement('div');
    hud.id = 'smgrade-compact-hud-controls';
    hud.innerHTML = `
      <button class="smgrade-plus-btn gold" id="sm-hud-gold-plus" title="Add or edit Gold balance">+</button>
      <button class="smgrade-plus-btn power" id="sm-hud-power-plus" title="Add or edit Combat Power">+</button>
      <button class="smgrade-plus-btn level" id="sm-hud-level-plus" title="Set Player Level">+</button>
      <button class="smgrade-plus-btn ore" id="sm-hud-ore-plus" title="Add Mine World Ores">+</button>
    `;
    document.body.appendChild(hud);

    document.getElementById('sm-hud-gold-plus').addEventListener('click', (e) => { e.stopPropagation(); openResourceModal('gold'); });
    document.getElementById('sm-hud-power-plus').addEventListener('click', (e) => { e.stopPropagation(); openResourceModal('power'); });
    document.getElementById('sm-hud-level-plus').addEventListener('click', (e) => { e.stopPropagation(); openResourceModal('level'); });
    document.getElementById('sm-hud-ore-plus').addEventListener('click', (e) => { e.stopPropagation(); openOreModal(); });
  }

  // --- 2. IN-INVENTORY TRIGGER BUTTONS (Phase 6 & Dwarfing) ---
  function createInInventoryTrigger() {
    let addBtn = document.getElementById('sm-inv-add-trigger');
    if (!addBtn) {
      addBtn = document.createElement('button');
      addBtn.id = 'sm-inv-add-trigger';
      addBtn.innerHTML = `<span>⚔️</span><span>Add Item</span>`;
      addBtn.style.display = 'none';
      document.body.appendChild(addBtn);

      addBtn.addEventListener('click', () => {
        openItemModal();
      });
    }

    let dwarfBtn = document.getElementById('sm-inv-dwarf-trigger');
    if (!dwarfBtn) {
      dwarfBtn = document.createElement('button');
      dwarfBtn.id = 'sm-inv-dwarf-trigger';
      dwarfBtn.innerHTML = `<span>🔨</span><span>Dwarf Blacksmith</span>`;
      dwarfBtn.style.display = 'none';
      document.body.appendChild(dwarfBtn);

      dwarfBtn.addEventListener('click', () => {
        const app = window.pcApp || (window.pc && window.pc.Application && window.pc.Application.getApplication());
        const upgraderUI = app?.root?.findByName('UpgraderUI');
        if (upgraderUI && upgraderUI.script?.upgraderController) {
          upgraderUI.script.upgraderController.show();
        } else if (upgraderUI) {
          upgraderUI.fire('UpgraderController:show');
        }
      });
    }
  }

  // --- 3. IN-PET TRIGGER BUTTON (Phase 7) ---
  function createInPetTrigger() {
    let btn = document.getElementById('sm-pet-add-trigger');
    if (btn) return;

    btn = document.createElement('button');
    btn.id = 'sm-pet-add-trigger';
    btn.innerHTML = `<span>🐾</span><span>Add Pet</span>`;
    btn.style.display = 'none';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      openPetModal();
    });
  }

  // --- 4. ITEM FORGE MODAL (Phase 6 & 9) ---
  function createItemModal() {
    let modal = document.getElementById('smgrade-item-modal');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'smgrade-item-modal';
    modal.className = 'smgrade-modal-overlay';
    modal.innerHTML = `
      <div class="smgrade-modal-dialog">
        <div class="smgrade-modal-header">
          <div class="smgrade-modal-title">
            <span>⚔️</span>
            <span>Item Forge & <span class="highlight">Equipment</span></span>
          </div>
          <button class="smgrade-modal-close" id="sm-item-close">&times;</button>
        </div>
        
        <div class="smgrade-modal-controls">
          <div class="smgrade-tabs">
            <button class="smgrade-tab-btn active" id="tab-swords">⚔️ Swords (46)</button>
            <button class="smgrade-tab-btn" id="tab-shields">🛡️ Shields (44)</button>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <select id="sm-rarity-filter" class="smgrade-select">
              <option value="all">All Rarities</option>
              <option value="Common">Common</option>
              <option value="Rare">Rare</option>
              <option value="Epic">Epic</option>
              <option value="Legendary">Legendary</option>
            </select>
            <input type="text" id="sm-item-search" class="smgrade-search-input" placeholder="Search weapons..." />
          </div>
        </div>

        <div class="smgrade-grid" id="sm-item-grid">
          <!-- Item Cards rendered dynamically -->
        </div>

        <!-- Enchants Selector Box (Phase 9) -->
        <div class="smgrade-enchants-box" id="sm-enchants-box" style="display: none;">
          <div style="font-size: 12px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.04em;">
            ✨ Enchantments (Configurable Levels):
          </div>
          <div id="sm-enchants-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <!-- Dynamically populated based on Swords vs Shields -->
          </div>
        </div>

        <div class="smgrade-modal-footer">
          <div class="smgrade-footer-info" id="sm-item-selected-info">
            <span style="font-size: 12px; color: rgba(255,255,255,0.5);">Select an item to forge</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="smgrade-level-select-wrap" id="sm-level-wrap" style="display: none; align-items: center; gap: 6px;">
              <span style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Level:</span>
              <div class="smgrade-level-selector">
                <button class="smgrade-level-btn" id="sm-lvl-minus">-</button>
                <span class="smgrade-level-val" id="sm-lvl-display">Lvl 1</span>
                <button class="smgrade-level-btn" id="sm-lvl-plus">+</button>
              </div>
            </div>
            <button class="smgrade-btn-primary" id="sm-forge-item-btn" disabled>Add to Inventory</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('sm-item-close').addEventListener('click', closeItemModal);
    document.getElementById('tab-swords').addEventListener('click', () => switchItemTab('swords'));
    document.getElementById('tab-shields').addEventListener('click', () => switchItemTab('shields'));
    document.getElementById('sm-rarity-filter').addEventListener('change', renderItemGrid);
    document.getElementById('sm-item-search').addEventListener('input', renderItemGrid);

    document.getElementById('sm-lvl-minus').addEventListener('click', () => {
      if (selectedLevel > 1) {
        selectedLevel--;
        updateLevelDisplay();
      }
    });
    document.getElementById('sm-lvl-plus').addEventListener('click', () => {
      if (selectedLevel < 5) {
        selectedLevel++;
        updateLevelDisplay();
      }
    });

    document.getElementById('sm-forge-item-btn').addEventListener('click', handleForgeItem);
  }

  function updateLevelDisplay() {
    const disp = document.getElementById('sm-lvl-display');
    if (!disp) return;
    if (selectedLevel === 3) disp.innerHTML = `Lvl 3 🔥`;
    else if (selectedLevel === 5) disp.innerHTML = `Lvl 5 💥`;
    else disp.textContent = `Lvl ${selectedLevel}`;
  }

  function switchItemTab(tab) {
    activeTab = tab;
    document.getElementById('tab-swords').classList.toggle('active', tab === 'swords');
    document.getElementById('tab-shields').classList.toggle('active', tab === 'shields');
    selectedItem = null;
    document.getElementById('sm-forge-item-btn').disabled = true;
    document.getElementById('sm-level-wrap').style.display = 'none';
    document.getElementById('sm-enchants-box').style.display = 'none';
    document.getElementById('sm-item-selected-info').innerHTML = `<span style="font-size: 12px; color: rgba(255,255,255,0.5);">Select an item to forge</span>`;
    renderItemGrid();
  }

  function renderItemGrid() {
    const grid = document.getElementById('sm-item-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const isSword = activeTab === 'swords';
    const catalog = isSword
      ? (window.SWORDMASTERS_SWORDS || (window.StaticData && StaticData.swords) || [])
      : (window.SWORDMASTERS_SHIELDS || (window.StaticData && StaticData.shields) || []);

    const filterRarity = document.getElementById('sm-rarity-filter').value;
    const searchVal = document.getElementById('sm-item-search').value.toLowerCase().trim();

    catalog.forEach((item, idx) => {
      if (!item) return;
      if (filterRarity !== 'all' && item.rarity !== filterRarity) return;
      if (searchVal && !item.name.toLowerCase().includes(searchVal)) return;

      const card = document.createElement('div');
      card.className = `smgrade-card ${selectedItem && selectedItem.type === item.type ? 'selected' : ''}`;
      
      const cleanName = item.name.trim().toLowerCase().replace(/ /g, '_').replace(/'/g, '').replace(/-/g, '_');
      const localImg = isSword ? `/images/swords/${cleanName}.png` : `/images/shields/${cleanName}.png`;

      card.innerHTML = `
        <div class="smgrade-card-img-wrap">
          <img src="${localImg}" class="smgrade-card-img" alt="${item.name}" />
        </div>
        <div class="smgrade-card-name" title="${item.name}">${item.name}</div>
        <div class="smgrade-card-badge ${item.rarity}">${item.rarity}</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('#sm-item-grid .smgrade-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedItem = item;
        document.getElementById('sm-forge-item-btn').disabled = false;
        document.getElementById('sm-level-wrap').style.display = 'flex';
        document.getElementById('sm-item-selected-info').innerHTML = `
          <div style="font-size: 13px; font-weight: 700; color: #fff;">
            ${item.name} <span style="color: var(--sm-gold); font-size: 11px;">(${item.rarity})</span>
          </div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.6);">
            ${isSword ? `Base Damage: ${item.damage || 10}` : `Protection: ${item.damageProtection || 100}`}
          </div>
        `;
        renderEnchantsUI(isSword);
      });

      grid.appendChild(card);
    });
  }

  function renderEnchantsUI(isSword) {
    const box = document.getElementById('sm-enchants-box');
    const content = document.getElementById('sm-enchants-content');
    if (!box || !content) return;
    box.style.display = 'flex';
    content.innerHTML = '';

    const options = isSword
      ? [
          { key: 'flame', name: '🔥 Flame (Burn Damage)', type: 0 },
          { key: 'looting', name: '💰 Looting (Coin Multiplier)', type: 2 },
          { key: 'freeze', name: '❄️ Freeze (Slow & Freeze)', type: 3 }
        ]
      : [
          { key: 'thorns', name: '🌵 Thorns (Damage Retaliation)', type: 1 },
          { key: 'looting', name: '💰 Looting (Coin Multiplier)', type: 2 },
          { key: 'fortune', name: '🍀 Fortune (Bonus Drops)', type: 4 }
        ];

    options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'smgrade-enchant-row';
      row.innerHTML = `
        <span class="smgrade-enchant-label">${opt.name}</span>
        <select class="smgrade-select" id="enc-${opt.key}">
          <option value="0">None</option>
          <option value="1">Level I</option>
          <option value="2">Level II</option>
          <option value="3">Level III</option>
        </select>
      `;
      content.appendChild(row);

      row.querySelector('select').addEventListener('change', (e) => {
        selectedEnchants[opt.key] = parseInt(e.target.value, 10);
      });
    });
  }

  function handleForgeItem() {
    if (!selectedItem) return;
    const isSword = activeTab === 'swords';

    const enchantsToApply = [];
    if (isSword) {
      if (selectedEnchants.flame > 0) enchantsToApply.push({ type: 0, level: selectedEnchants.flame, name: 'Flame' });
      if (selectedEnchants.looting > 0) enchantsToApply.push({ type: 2, level: selectedEnchants.looting, name: 'Looting' });
      if (selectedEnchants.freeze > 0) enchantsToApply.push({ type: 3, level: selectedEnchants.freeze, name: 'Freeze' });
    } else {
      if (selectedEnchants.thorns > 0) enchantsToApply.push({ type: 1, level: selectedEnchants.thorns, name: 'Thorns' });
      if (selectedEnchants.looting > 0) enchantsToApply.push({ type: 2, level: selectedEnchants.looting, name: 'Looting' });
      if (selectedEnchants.fortune > 0) enchantsToApply.push({ type: 4, level: selectedEnchants.fortune, name: 'Fortune' });
    }

    if (window.addStandaloneItem) {
      window.addStandaloneItem({
        isSword,
        type: selectedItem.type,
        level: selectedLevel,
        enchantments: enchantsToApply
      });
      showToast(`Forged and added ${selectedItem.name} (Lvl ${selectedLevel}) to inventory!`, '⚔️');
      closeItemModal();
    }
  }

  function openItemModal() {
    createItemModal();
    const modal = document.getElementById('smgrade-item-modal');
    modal.classList.add('active');
    lockMouseForModal(true);
    renderItemGrid();
  }

  function closeItemModal() {
    const modal = document.getElementById('smgrade-item-modal');
    if (modal) modal.classList.remove('active');
    lockMouseForModal(false);
  }

  // --- 5. PET FORGE MODAL (Phase 7) ---
  function createPetModal() {
    let modal = document.getElementById('smgrade-pet-modal');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'smgrade-pet-modal';
    modal.className = 'smgrade-modal-overlay';
    modal.innerHTML = `
      <div class="smgrade-modal-dialog">
        <div class="smgrade-modal-header">
          <div class="smgrade-modal-title">
            <span>🐾</span>
            <span>Pet Menagerie & <span class="highlight">Summoner</span></span>
          </div>
          <button class="smgrade-modal-close" id="sm-pet-close">&times;</button>
        </div>
        
        <div class="smgrade-modal-controls">
          <span style="font-size: 13px; font-weight: 700; color: #cbd5e1;">Available Authentic Pets (36 Species):</span>
          <input type="text" id="sm-pet-search" class="smgrade-search-input" placeholder="Search pets..." />
        </div>

        <div class="smgrade-grid" id="sm-pet-grid"></div>

        <div class="smgrade-modal-footer">
          <div class="smgrade-footer-info" id="sm-pet-selected-info">
            <span style="font-size: 12px; color: rgba(255,255,255,0.5);">Select a pet to summon</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Amount:</span>
              <input type="number" id="sm-pet-amount-input" class="smgrade-select" value="1" min="1" max="999" style="width: 70px;" />
            </div>
            <button class="smgrade-btn-primary" id="sm-summon-pet-btn" disabled>Add Pet</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('sm-pet-close').addEventListener('click', closePetModal);
    document.getElementById('sm-pet-search').addEventListener('input', renderPetGrid);
    document.getElementById('sm-summon-pet-btn').addEventListener('click', handleSummonPet);
  }

  function renderPetGrid() {
    const grid = document.getElementById('sm-pet-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const petsCatalog = window.SWORDMASTERS_PETS || (window.StaticData && StaticData.pets) || [];
    const searchVal = document.getElementById('sm-pet-search').value.toLowerCase().trim();

    petsCatalog.forEach((pet, idx) => {
      if (!pet) return;
      if (searchVal && !pet.name.toLowerCase().includes(searchVal)) return;

      const card = document.createElement('div');
      card.className = `smgrade-card ${selectedPet && selectedPet.type === pet.type ? 'selected' : ''}`;
      
      const cleanName = pet.name.trim().toLowerCase().replace(/ /g, '_');
      const localImg = `/images/pets/${cleanName}.png`;

      card.innerHTML = `
        <div class="smgrade-card-img-wrap">
          <img src="${localImg}" class="smgrade-card-img" alt="${pet.name}" />
        </div>
        <div class="smgrade-card-name" title="${pet.name}">${pet.name}</div>
        <div class="smgrade-card-badge ${pet.rarity || 'Common'}">${pet.rarity || 'Common'}</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('#sm-pet-grid .smgrade-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedPet = pet;
        document.getElementById('sm-summon-pet-btn').disabled = false;
        document.getElementById('sm-pet-selected-info').innerHTML = `
          <div style="font-size: 13px; font-weight: 700; color: #fff;">
            ${pet.name} <span style="color: var(--sm-gold); font-size: 11px;">(${pet.rarity || 'Common'})</span>
          </div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.6);">
            Speed Buff: +${Math.round((pet.speedMultiplier || 0) * 100)}%
          </div>
        `;
      });

      grid.appendChild(card);
    });
  }

  function handleSummonPet() {
    if (!selectedPet) return;
    const amount = parseInt(document.getElementById('sm-pet-amount-input').value, 10) || 1;

    if (window.addStandalonePet) {
      window.addStandalonePet({
        type: selectedPet.type,
        amount: amount
      });
      showToast(`Added ${amount}x ${selectedPet.name} into pet inventory!`, '🐾');
      closePetModal();
    }
  }

  function openPetModal() {
    createPetModal();
    const modal = document.getElementById('smgrade-pet-modal');
    modal.classList.add('active');
    lockMouseForModal(true);
    renderPetGrid();
  }

  function closePetModal() {
    const modal = document.getElementById('smgrade-pet-modal');
    if (modal) modal.classList.remove('active');
    lockMouseForModal(false);
  }

  // --- 6. MINE WORLD ORE MODAL (Phase 8) ---
  function createOreModal() {
    let modal = document.getElementById('smgrade-ore-modal');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'smgrade-ore-modal';
    modal.className = 'smgrade-modal-overlay';
    modal.innerHTML = `
      <div class="smgrade-modal-dialog" style="max-width: 500px;">
        <div class="smgrade-modal-header">
          <div class="smgrade-modal-title">
            <span>💎</span>
            <span>Mine World <span class="highlight">Ore Bank</span></span>
          </div>
          <button class="smgrade-modal-close" id="sm-ore-close">&times;</button>
        </div>
        
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 6px;">Select Ore Type:</label>
            <select id="sm-ore-type" class="smgrade-select" style="width: 100%;">
              <option value="0">Coal (Type 0)</option>
              <option value="1">Emerald (Type 1)</option>
              <option value="2">Diamond (Type 2)</option>
              <option value="3">Ruby (Type 3)</option>
              <option value="4">Gold (Type 4)</option>
            </select>
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 6px;">Ore State:</label>
            <div style="display: flex; gap: 12px;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                <input type="radio" name="ore-state" value="raw" checked /> Raw Ore
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                <input type="radio" name="ore-state" value="smelted" /> Smelted (Melted)
              </label>
            </div>
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 6px;">Quantity:</label>
            <input type="number" id="sm-ore-qty" class="smgrade-select" value="50" min="1" max="10000" style="width: 100%;" />
          </div>
        </div>

        <div class="smgrade-modal-footer">
          <div></div>
          <button class="smgrade-btn-primary" id="sm-add-ore-btn">Add Ore</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('sm-ore-close').addEventListener('click', closeOreModal);
    document.getElementById('sm-add-ore-btn').addEventListener('click', handleAddOre);
  }

  function handleAddOre() {
    const type = parseInt(document.getElementById('sm-ore-type').value, 10);
    const isMelted = document.querySelector('input[name="ore-state"]:checked').value === 'smelted';
    const amount = parseInt(document.getElementById('sm-ore-qty').value, 10) || 1;

    if (window.addStandaloneOre) {
      window.addStandaloneOre({ type, isMelted, amount });
      const names = ['Coal', 'Emerald', 'Diamond', 'Ruby', 'Gold'];
      showToast(`Added ${amount}x ${isMelted ? 'Smelted ' : 'Raw '}${names[type]}!`, '💎');
      closeOreModal();
    }
  }

  function openOreModal() {
    createOreModal();
    const modal = document.getElementById('smgrade-ore-modal');
    modal.classList.add('active');
    lockMouseForModal(true);
  }

  function closeOreModal() {
    const modal = document.getElementById('smgrade-ore-modal');
    if (modal) modal.classList.remove('active');
    lockMouseForModal(false);
  }

  // --- 7. COMPACT RESOURCE EDITOR MODAL (Phase 10) ---
  let activeResourceType = 'gold'; // 'gold' | 'power' | 'level'

  function createResourceModal() {
    let modal = document.getElementById('smgrade-resource-modal');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'smgrade-resource-modal';
    modal.className = 'smgrade-modal-overlay';
    modal.innerHTML = `
      <div class="smgrade-modal-dialog" style="max-width: 440px;">
        <div class="smgrade-modal-header">
          <div class="smgrade-modal-title">
            <span id="sm-res-icon">💰</span>
            <span id="sm-res-title">Edit Resource</span>
          </div>
          <button class="smgrade-modal-close" id="sm-res-close">&times;</button>
        </div>
        
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.7);" id="sm-res-desc">
            Enter desired amount (supports numbers or formats like 100M, 50B, 10QT, 1QNT):
          </div>
          <input type="text" id="sm-res-input" class="smgrade-search-input" style="width: 100%; font-size: 15px; font-weight: 700; padding: 10px;" />
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="smgrade-tab-btn" id="res-preset-1">+100M</button>
            <button class="smgrade-tab-btn" id="res-preset-2">+1B</button>
            <button class="smgrade-tab-btn" id="res-preset-3">+100B</button>
            <button class="smgrade-tab-btn" id="res-preset-4">+1QT</button>
          </div>
        </div>

        <div class="smgrade-modal-footer">
          <div></div>
          <button class="smgrade-btn-primary" id="sm-res-apply-btn">Apply Amount</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('sm-res-close').addEventListener('click', closeResourceModal);
    document.getElementById('sm-res-apply-btn').addEventListener('click', handleApplyResource);

    document.getElementById('res-preset-1').addEventListener('click', () => { document.getElementById('sm-res-input').value = '100M'; });
    document.getElementById('res-preset-2').addEventListener('click', () => { document.getElementById('sm-res-input').value = '1B'; });
    document.getElementById('res-preset-3').addEventListener('click', () => { document.getElementById('sm-res-input').value = '100B'; });
    document.getElementById('res-preset-4').addEventListener('click', () => { document.getElementById('sm-res-input').value = '1QT'; });
  }

  function openResourceModal(type) {
    createResourceModal();
    activeResourceType = type;
    const modal = document.getElementById('smgrade-resource-modal');
    const title = document.getElementById('sm-res-title');
    const icon = document.getElementById('sm-res-icon');
    const input = document.getElementById('sm-res-input');

    const profile = window.getLocalArcadeProfile ? window.getLocalArcadeProfile() : {};

    if (type === 'gold') {
      title.textContent = 'Edit Gold Balance';
      icon.textContent = '💰';
      input.value = String(profile.gold || 50000000);
    } else if (type === 'power') {
      title.textContent = 'Edit Combat Power';
      icon.textContent = '⚡';
      input.value = String(profile.power || 2500);
    } else if (type === 'level') {
      title.textContent = 'Set Player Level';
      icon.textContent = '⭐';
      input.value = String(profile.level || 1);
    }

    modal.classList.add('active');
    lockMouseForModal(true);
    input.focus();
  }

  function closeResourceModal() {
    const modal = document.getElementById('smgrade-resource-modal');
    if (modal) modal.classList.remove('active');
    lockMouseForModal(false);
  }

  function handleApplyResource() {
    const val = document.getElementById('sm-res-input').value;
    if (window.setStandaloneResource) {
      window.setStandaloneResource(activeResourceType, val);
      showToast(`Updated ${activeResourceType} balance!`, '✨');
      closeResourceModal();
    }
  }

  // --- 8. NICKNAME START PANEL (Phase 5) ---
  function createStartPanel() {
    let panel = document.getElementById('smgrade-start-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'smgrade-start-panel';
      panel.className = 'active';

      const randNames = ['BladeMaster', 'ShadowKnight', 'FrostWalker', 'OrcBane', 'DragonSlayer', 'ArcadeHero'];
      const defaultName = (localStorage.getItem('arcade_username') || randNames[Math.floor(Math.random() * randNames.length)]) + '_' + Math.floor(Math.random() * 899 + 100);

      panel.innerHTML = `
        <div class="smgrade-start-card">
          <div style="font-size: 32px; margin-bottom: 6px;">⚔️</div>
          <h2 style="font-family: 'Cinzel', serif; font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px; letter-spacing: 0.05em;">
            SWORDMASTERS <span style="color: #f59e0b;">ARCADE</span>
          </h2>
          <p style="font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 24px;">
            Standalone 100% Offline Mode. Enter a nickname to enter the world.
          </p>

          <div style="display: flex; gap: 8px; margin-bottom: 20px;">
            <input type="text" id="sm-start-nickname-input" class="smgrade-search-input" value="${defaultName}" style="flex: 1; font-size: 14px; font-weight: 700; padding: 10px 14px;" placeholder="Enter nickname..." />
            <button id="sm-start-rand-btn" class="smgrade-tab-btn" title="Generate Random Name" style="padding: 10px 14px; font-size: 14px;">🎲</button>
          </div>

          <button id="sm-start-submit-btn" class="smgrade-btn-primary" style="width: 100%; padding: 12px; font-size: 14px;">
            Enter Game World
          </button>
        </div>
      `;
      document.body.appendChild(panel);

      document.getElementById('sm-start-rand-btn').addEventListener('click', () => {
        const rName = randNames[Math.floor(Math.random() * randNames.length)] + '_' + Math.floor(Math.random() * 899 + 100);
        document.getElementById('sm-start-nickname-input').value = rName;
      });

      document.getElementById('sm-start-submit-btn').addEventListener('click', () => {
        const nick = document.getElementById('sm-start-nickname-input').value.trim() || defaultName;
        localStorage.setItem('arcade_username', nick);
        panel.classList.remove('active');
        panel.style.display = 'none';
        if (window.standaloneRoom) {
          window.standaloneRoom.profile.username = nick;
          const p = window.standaloneRoom.state.players.items[window.standaloneRoom.sessionId];
          if (p) p.username = nick;
        }
        lockMouseForModal(false);
      });
    }
  }

  // --- 9. WATCH PLAYCANVAS APP INVENTORY & PET EVENTS ---
  function monitorPlayCanvasEvents() {
    const checkApp = setInterval(() => {
      const app = window.pcApp || (window.pc && window.pc.Application && window.pc.Application.getApplication());
      if (app && app.networkManager) {
        clearInterval(checkApp);
        console.log('[SMGrade Overlay] Hooked into PlayCanvas application events.');

        // Initialize HUD and In-Panel triggers
        createHudControls();
        createInInventoryTrigger();
        createInPetTrigger();

        // Patch I key toggle with clean debounce to ensure pressing I opens and keeps inventory open reliably
        if (window.InventoryController && !window.InventoryController._iDebounced) {
          window.InventoryController._iDebounced = true;
          window.InventoryController.prototype.update = function (dt) {
            if (this.app.isWatchingAd) return;
            if (this.app.keyboard && this.app.keyboard.wasPressed(pc.KEY_I)) {
              const now = Date.now();
              if (!this._lastToggle || now - this._lastToggle > 250) {
                this._lastToggle = now;
                if (!this.inventoryEnabled) {
                  this.entity.button.fire("click");
                } else {
                  this.closeButton.button.fire("click");
                }
              }
            }
          };
        }

        // Continually synchronize In-Inventory and In-Pet triggers
        setInterval(() => {
          const invCtrl = app.networkManager?.inventoryController;
          const invTrigger = document.getElementById('sm-inv-add-trigger');
          const dwarfTrigger = document.getElementById('sm-inv-dwarf-trigger');
          if (invCtrl) {
            const isInvOpen = !!invCtrl.inventoryEnabled;
            if (invTrigger) invTrigger.style.display = isInvOpen ? 'flex' : 'none';
            if (dwarfTrigger) dwarfTrigger.style.display = isInvOpen ? 'flex' : 'none';
          }

          const petUI = app.root?.findByName('PetUI');
          const petTrigger = document.getElementById('sm-pet-add-trigger');
          if (petTrigger && petUI) {
            const isPetOpen = !!(petUI.enabled && petUI.children[0] && petUI.children[0].enabled);
            petTrigger.style.display = isPetOpen ? 'flex' : 'none';
          }
        }, 100);
      }
    }, 400);
  }

  // Expose modal API on window
  window.openItemModal = openItemModal;
  window.closeItemModal = closeItemModal;
  window.switchItemTab = switchItemTab;
  window.openPetModal = openPetModal;
  window.closePetModal = closePetModal;
  window.openOreModal = openOreModal;
  window.closeOreModal = closeOreModal;
  window.openResourceModal = openResourceModal;
  window.closeResourceModal = closeResourceModal;

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createStartPanel();
      monitorPlayCanvasEvents();
    });
  } else {
    createStartPanel();
    monitorPlayCanvasEvents();
  }
})();
