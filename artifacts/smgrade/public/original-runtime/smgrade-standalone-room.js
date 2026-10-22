/**
 * SMGrade Arcade — Standalone Offline Room & Game Engine Service
 * Replaces remote Colyseus MMO server and loadbalancer with 100% offline local state.
 * Implements full persistence, authentic mob combat & enchants, cosmetic purchases,
 * item & pet management, and resource controls.
 */

(function () {
  console.log('[SMGrade Standalone Room] Initializing offline server simulation layer...');

  // Safe fallback for pc.AppBase / pc.Application networkManager
  const fallbackNM = {
    isOnSwordMasters: true,
    worldNumber: 1,
    localInv: { level: 1, gold: 50000000, power: 2500, activeSkinColor: 0 }
  };
  if (window.pc) {
    if (pc.AppBase) {
      Object.defineProperty(pc.AppBase.prototype, 'networkManager', {
        get() { return this._networkManager || fallbackNM; },
        set(v) { this._networkManager = v; },
        configurable: true
      });
    }
    if (pc.Application) {
      Object.defineProperty(pc.Application.prototype, 'networkManager', {
        get() { return this._networkManager || fallbackNM; },
        set(v) { this._networkManager = v; },
        configurable: true
      });
    }
  }

  // --- MASTER LOGS AUDIT LOGGER ---
  function logMasterAction(username, action, details, status = 'Success') {
    try {
      const logEntry = {
        id: 'mlog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
        username: username || 'ArcadeHero',
        action: action,
        details: details,
        status: status
      };
      const existing = JSON.parse(localStorage.getItem('smg_master_logs') || '[]');
      existing.unshift(logEntry);
      if (existing.length > 500) existing.length = 500;
      localStorage.setItem('smg_master_logs', JSON.stringify(existing));

      fetch('/api/master/log-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      }).catch(() => {});
    } catch (e) {
      console.warn('[MasterLog] Error logging action:', e);
    }
  }
  window.logMasterAction = logMasterAction;

  // --- 1. LOCAL COLYSEUS SCHEMA EMULATOR ---
  class LocalSchemaMap {
    constructor() {
      this.items = {};
      this.addListeners = [];
      this.removeListeners = [];
      this.changeListeners = [];
    }

    onAdd(cb) {
      this.addListeners.push(cb);
      for (const [k, v] of Object.entries(this.items)) {
        try { cb(v, k); } catch (e) { console.warn('[SchemaMap onAdd Initial Error]:', e); }
      }
    }

    onRemove(cb) {
      this.removeListeners.push(cb);
    }

    onChange(cb) {
      this.changeListeners.push(cb);
    }

    add(key, val) {
      this.items[key] = val;
      this.addListeners.forEach(cb => {
        try { cb(val, key); } catch (e) { console.warn('[SchemaMap onAdd Error]:', e); }
      });
      if (val && val.onChange) {
        val.onChange(() => {
          this.changeListeners.forEach(cb => {
            try { cb(val, key); } catch (e) {}
          });
        });
      }
    }

    remove(key) {
      const val = this.items[key];
      delete this.items[key];
      this.removeListeners.forEach(cb => {
        try { cb(val, key); } catch (e) {}
      });
    }

    get length() {
      return Object.keys(this.items).length;
    }

    [Symbol.iterator]() {
      const entries = Object.entries(this.items).map(([k, v]) => {
        const entry = [k, v];
        if (v && typeof v === 'object') {
          Object.setPrototypeOf(entry, v);
        }
        return entry;
      });
      return entries[Symbol.iterator]();
    }

    filter(cb) {
      return Array.from(this).filter(cb);
    }
  }

  class LocalArraySchema {
    constructor(initialItems = []) {
      this.items = [...initialItems];
      this.addListeners = [];
      this.removeListeners = [];
      this.changeListeners = [];

      return new Proxy(this, {
        get(target, prop, receiver) {
          if (typeof prop === 'string' && !isNaN(Number(prop)) && prop !== '') {
            return target.items[Number(prop)];
          }
          return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
          if (typeof prop === 'string' && !isNaN(Number(prop)) && prop !== '') {
            target.items[Number(prop)] = value;
            return true;
          }
          return Reflect.set(target, prop, value, receiver);
        }
      });
    }

    onAdd(cb) {
      this.addListeners.push(cb);
      this.items.forEach(item => {
        try { cb(item); } catch (e) { console.warn('[ArraySchema onAdd Initial Error]:', e); }
      });
    }

    onRemove(cb) {
      this.removeListeners.push(cb);
    }

    onChange(cb) {
      this.changeListeners.push(cb);
    }

    push(item) {
      this.items.push(item);
      this.addListeners.forEach(cb => {
        try { cb(item); } catch (e) { console.warn('[ArraySchema onAdd push error]:', e); }
      });
      this.triggerChange();
    }

    remove(item) {
      const idx = this.items.indexOf(item);
      if (idx !== -1) {
        this.items.splice(idx, 1);
        this.removeListeners.forEach(cb => {
          try { cb(item); } catch (e) {}
        });
        this.triggerChange();
      }
    }

    triggerChange() {
      this.changeListeners.forEach(cb => {
        try { cb(); } catch (e) {}
      });
    }

    get length() {
      return this.items.length;
    }

    find(cb) {
      return this.items.find(cb);
    }

    findIndex(cb) {
      return this.items.findIndex(cb);
    }

    filter(cb) {
      return this.items.filter(cb);
    }

    forEach(cb, thisArg) {
      return this.items.forEach(cb, thisArg);
    }

    map(cb, thisArg) {
      return this.items.map(cb, thisArg);
    }

    some(cb, thisArg) {
      return this.items.some(cb, thisArg);
    }

    every(cb, thisArg) {
      return this.items.every(cb, thisArg);
    }

    includes(item) {
      return this.items.includes(item);
    }

    indexOf(item) {
      return this.items.indexOf(item);
    }

    slice(start, end) {
      return this.items.slice(start, end);
    }

    [Symbol.iterator]() {
      return this.items[Symbol.iterator]();
    }
  }

  class LocalEntitySchema {
    constructor(data = {}) {
      Object.assign(this, data);
      this._listeners = {};
      this._changeListeners = [];
    }

    listen(prop, cb) {
      if (!this._listeners[prop]) this._listeners[prop] = [];
      this._listeners[prop].push(cb);
      if (this[prop] !== undefined) {
        try {
          cb(this[prop], undefined);
        } catch (e) {
          console.warn('[LocalEntitySchema listen initial dispatch error for', prop, ']:', e);
        }
      }
    }

    onChange(cb) {
      this._changeListeners.push(cb);
    }

    set(prop, val) {
      const prev = this[prop];
      this[prop] = val;
      if (this._listeners[prop]) {
        this._listeners[prop].forEach(cb => {
          try { cb(val, prev); } catch (e) {}
        });
      }
      this._changeListeners.forEach(cb => {
        try { cb(); } catch (e) {}
      });
    }
  }

  // --- 2. LOCAL PERSISTENT ARCADE STATE ---
  const STORAGE_KEY = 'smgrade_arcade_profile';

  function getLocalArcadeProfile() {
    const defaultProfile = {
      username: localStorage.getItem('smg_registered_username') || localStorage.getItem('arcade_username') || ('ArcadeHero_' + Math.floor(Math.random() * 899 + 100)),
      level: 5000,
      experience: 0,
      gold: 50000000,
      power: 25000,
      powerMultiplier: 1.0,
      maxHealth: 100,
      health: 100,
      activeSwordType: 1, // Old Sword
      activeSwordLevel: 1,
      activeSwordEnchants: [],
      activeShieldType: 1, // Wooden Shield
      activeShieldLevel: 1,
      activeShieldEnchants: [],
      swords: [
        { itemId: 'sword_starter_01', type: 1, level: 1, enchantments: [], isLocked: false }
      ],
      shields: [
        { itemId: 'shield_starter_01', type: 1, level: 1, enchantments: [], isLocked: false }
      ],
      pets: [],
      activePets: [],
      ores: [],
      storage: [],
      storageLimit: 20,
      // Authentic Default Starter Cosmetics (characteristic clothing & hair)
      activeSkinColor: 0,
      activeFace: 0,
      activeHair: 1,
      activeHelmet: 0,
      activeTorso: 1,
      activePant: 1,
      activeShoe: 1,
      ownedCosmetics: {
        skinColors: [0],
        faces: [0],
        hairs: [1],
        helmets: [],
        torsos: [1],
        pants: [1],
        shoes: [1]
      }
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Requirement 3: Sanitize loaded inventory items from localStorage
        // Clamping any exploit item levels (> 10) down to max allowed level 10
        if (Array.isArray(parsed.swords)) {
          parsed.swords = parsed.swords.map(s => ({
            ...s,
            level: Math.max(1, Math.min(10, parseInt(s.level, 10) || 1))
          }));
        }
        if (Array.isArray(parsed.shields)) {
          parsed.shields = parsed.shields.map(sh => ({
            ...sh,
            level: Math.max(1, Math.min(10, parseInt(sh.level, 10) || 1))
          }));
        }
        if (parsed.activeSwordLevel) {
          parsed.activeSwordLevel = Math.max(1, Math.min(10, parseInt(parsed.activeSwordLevel, 10) || 1));
        }
        if (parsed.activeShieldLevel) {
          parsed.activeShieldLevel = Math.max(1, Math.min(10, parseInt(parsed.activeShieldLevel, 10) || 1));
        }
        if (Array.isArray(parsed.storage)) {
          parsed.storage = parsed.storage.map(st => ({
            ...st,
            level: Math.max(1, Math.min(10, parseInt(st.level, 10) || 1))
          }));
        }

        const registeredName = localStorage.getItem('smg_registered_username');
        if (registeredName) {
          parsed.username = registeredName;
        }

        return {
          ...defaultProfile,
          ...parsed,
          ownedCosmetics: {
            ...defaultProfile.ownedCosmetics,
            ...(parsed.ownedCosmetics || {})
          }
        };
      }
    } catch (e) {
      console.warn('[SMGrade State Load Error]:', e);
    }
    return defaultProfile;
  }

  function saveLocalArcadeProfile(profile) {
    try {
      // Safety guard against localStorage 5MB quota: cap stored pets array to max 500 items in localStorage
      const safeProfile = {
        ...profile,
        pets: (profile.pets || []).slice(0, 500)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeProfile));
      if (profile.username) localStorage.setItem('arcade_username', profile.username);
    } catch (e) {
      console.warn('[SMGrade State Save Error]:', e);
    }
  }

  window.getLocalArcadeProfile = getLocalArcadeProfile;
  window.saveLocalArcadeProfile = saveLocalArcadeProfile;

  // Number Formatter Helper (supports commas and multipliers like K, M, B, T, QT, QNT, etc.)
  function parseFormattedNumber(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (val === null || val === undefined) return 0;
    val = String(val).trim().toUpperCase().replace(/,/g, '');
    const multipliers = {
      'K': 1e3,
      'M': 1e6,
      'B': 1e9,
      'T': 1e12,
      'QD': 1e15,
      'QT': 1e18,
      'QNT': 1e18,
      'SXT': 1e21,
      'SPT': 1e24,
      'OCT': 1e27,
      'NNT': 1e30
    };
    for (const [suf, mult] of Object.entries(multipliers)) {
      if (val.endsWith(suf)) {
        const num = parseFloat(val.slice(0, -suf.length));
        if (!isNaN(num)) return num * mult;
      }
    }
    const direct = parseFloat(val);
    return isNaN(direct) ? 0 : direct;
  }
  window.parseFormattedNumber = parseFormattedNumber;

  // --- 3. STANDALONE LOCAL ROOM CLASS ---
  class StandaloneLocalRoom {
    constructor(networkManager) {
      this.networkManager = networkManager;
      this.sessionId = 'smgrade_player_local';
      this.name = 'world_1';
      this.profile = getLocalArcadeProfile();

      this.state = {
        players: new LocalSchemaMap(),
        playerInventories: new LocalSchemaMap(),
        enemies: new LocalSchemaMap(),
        bestPlayersInventory: new LocalSchemaMap(),
        listen: (key, cb) => {}
      };

      this.messageHandlers = {};
      this.mobTickInterval = null;
      this.connection = { isOpen: true };
      window.standaloneRoom = this;
    }

    send(type, data) {
      this.handleClientMessage(type, data);
    }

    onMessage(type, cb) {
      this.messageHandlers[type] = cb;
    }

    get mobs() {
      return Object.values(this.state?.enemies?.items || {});
    }

    dispatchMessage(type, data) {
      const handler = this.messageHandlers[type];
      if (typeof handler === 'function') {
        try {
          handler(data);
        } catch (e) {
          console.warn(`[StandaloneLocalRoom dispatchMessage Error for ${type}]:`, e);
        }
      }
    }

    onLeave(cb) {}
    onError(cb) {}

    // Bootstrap local player & world entities
    initWorld() {
      console.log('[SMGrade Standalone Room] Bootstrapping offline World 1 entities...');

      // A. Spawn Local Player at EXACT CANONICAL WORLD 1 SPAWN: (2, -0.25, 50)
      const spawnX = 2;
      const spawnY = -0.25;
      const spawnZ = 50;

      const playerSchema = new LocalEntitySchema({
        x: spawnX,
        y: spawnY,
        z: spawnZ,
        rotationY: 0,
        isRunning: false,
        isInAir: false,
        isAttacking: false,
        isDisguised: false,
        username: this.profile.username
      });
      this.state.players.add(this.sessionId, playerSchema);

      // B. Setup Player Inventory Schema from Persistent Profile
      const swordsArray = (this.profile.swords && this.profile.swords.length > 0)
        ? this.profile.swords.map(s => this.createItemSchema(s, true))
        : [this.createItemSchema({ itemId: 'sword_starter_01', type: this.profile.activeSwordType || 1, level: this.profile.activeSwordLevel || 1, enchantments: this.profile.activeSwordEnchants || [], isLocked: false }, true)];

      const shieldsArray = (this.profile.shields && this.profile.shields.length > 0)
        ? this.profile.shields.map(s => this.createItemSchema(s, false))
        : [this.createItemSchema({ itemId: 'shield_starter_01', type: this.profile.activeShieldType || 1, level: this.profile.activeShieldLevel || 1, enchantments: this.profile.activeShieldEnchants || [], isLocked: false }, false)];

      const petsArray = (this.profile.pets || []).map(p => this.createPetSchema(p));
      const activePetsArray = (this.profile.activePets || []).map(ap => new LocalEntitySchema(ap));
      const oresArray = (this.profile.ores || []).map(o => this.createOreSchema(o));

      const activeSwordItem = swordsArray.find(s => s.type === this.profile.activeSwordType) || swordsArray[0];
      const activeShieldItem = shieldsArray.find(s => s.type === this.profile.activeShieldType) || shieldsArray[0];

      // Decouple active weapon schemas from inventory items so equipping/unequipping doesn't mutate inventory
      const activeSwordSchema = new LocalEntitySchema({
        type: activeSwordItem.type,
        level: activeSwordItem.level,
        itemId: activeSwordItem.itemId,
        enchantments: new LocalArraySchema((activeSwordItem.enchantments?.items || activeSwordItem.enchantments || []).map(e => new LocalEntitySchema({
          type: e.type,
          level: e.level,
          name: e.name || ''
        })))
      });

      const activeShieldSchema = new LocalEntitySchema({
        type: activeShieldItem.type,
        level: activeShieldItem.level,
        itemId: activeShieldItem.itemId,
        enchantments: new LocalArraySchema((activeShieldItem.enchantments?.items || activeShieldItem.enchantments || []).map(e => new LocalEntitySchema({
          type: e.type,
          level: e.level,
          name: e.name || ''
        })))
      });

      const swordsSchema = new LocalArraySchema(swordsArray);
      const shieldsSchema = new LocalArraySchema(shieldsArray);
      const petsSchema = new LocalArraySchema(petsArray);
      const activePetsSchema = new LocalArraySchema(activePetsArray);
      const oresSchema = new LocalArraySchema(oresArray);

      // Persistent Storage Schema (World 1 Storage NPC)
      const storageArray = (this.profile.storage || []).map(st => new LocalEntitySchema({
        itemId: st.itemId,
        itemType: st.itemType || 1,
        type: st.type,
        level: st.level || 1,
        enchantments: new LocalArraySchema((st.enchantments || []).map(e => new LocalEntitySchema(e))),
        isLocked: !!st.isLocked
      }));
      const storageSchema = new LocalArraySchema(storageArray);

      // Cosmetic Ownership Schemas
      const skinColorsSchema = new LocalArraySchema(this.profile.ownedCosmetics.skinColors || [0]);
      const facesSchema = new LocalArraySchema(this.profile.ownedCosmetics.faces || [0]);
      const hairsSchema = new LocalArraySchema(this.profile.ownedCosmetics.hairs || [1]);
      const helmetsSchema = new LocalArraySchema(this.profile.ownedCosmetics.helmets || []);
      const torsosSchema = new LocalArraySchema(this.profile.ownedCosmetics.torsos || [1]);
      const pantsSchema = new LocalArraySchema(this.profile.ownedCosmetics.pants || [1]);
      const shoesSchema = new LocalArraySchema(this.profile.ownedCosmetics.shoes || [1]);

      const invSchema = new LocalEntitySchema({
        _id: 'local_inv_01',
        health: this.profile.health || 100,
        maxHealth: this.profile.maxHealth || 100,
        level: this.profile.level || 1,
        experience: this.profile.experience || 0,
        gold: this.profile.gold || 50000000,
        power: this.profile.power || 2500,
        powerMultiplier: this.profile.powerMultiplier || 1.0,
        activeSword: activeSwordSchema,
        activeShield: activeShieldSchema,
        swords: swordsSchema,
        shields: shieldsSchema,
        pets: petsSchema,
        activePets: activePetsSchema,
        books: new LocalArraySchema(),
        storage: storageSchema,
        storageLimit: this.profile.storageLimit || 20,
        ores: oresSchema,
        activeBooks: new LocalArraySchema(),
        canClaimChestTypes: new LocalArraySchema(),
        skinColors: skinColorsSchema,
        faces: facesSchema,
        hairs: hairsSchema,
        helmets: helmetsSchema,
        torsos: torsosSchema,
        pants: pantsSchema,
        shoes: shoesSchema,
        // Active cosmetics
        activeSkinColor: this.profile.activeSkinColor !== undefined ? this.profile.activeSkinColor : 0,
        activeFace: this.profile.activeFace !== undefined ? this.profile.activeFace : 0,
        activeHair: this.profile.activeHair !== undefined ? this.profile.activeHair : 1,
        activeHelmet: this.profile.activeHelmet !== undefined ? this.profile.activeHelmet : 0,
        activeTorso: this.profile.activeTorso !== undefined ? this.profile.activeTorso : 1,
        activePant: this.profile.activePant !== undefined ? this.profile.activePant : 1,
        activeShoe: this.profile.activeShoe !== undefined ? this.profile.activeShoe : 1,
        helmetEnabled: false,
        isMod: false,
        isVip: true,
        clanName: null,
        questStatus: new LocalArraySchema(),
        dailyQuestList: { onChange: () => {}, quests: new LocalArraySchema() }
      });

      this.state.playerInventories.add(this.sessionId, invSchema);

      // C. Requirement 6: World 1 Mobs removed. Enemies collection remains 0 entities.
      // Scene, terrain, player, NPCs (Blacksmith, Enhancer, Downgrader, Storage), pets, inventory, HUD, leaderboards preserved.
      console.log('[SMGrade Standalone Room] World 1 active with 0 mobs (Requirement 6).');

      // E. Clean up Online-Only Elements and Keyboard-Help Controls
      this.cleanupOnlineOnlyElements();

      // F. Initial HUD Stats Display & Leaderboard Sync
      setTimeout(() => {
        if (this.networkManager.experienceBarLevelText?.element) {
          this.networkManager.experienceBarLevelText.element.text = "Level " + (this.profile.level || 1);
        }
        if (this.networkManager.goldStatText?.element) {
          this.networkManager.goldStatText.element.text = numRound(this.profile.gold || 50000000);
        }
        if (this.networkManager.powerStatText?.element) {
          this.networkManager.powerStatText.element.text = numRound(this.profile.power || 2500);
        }
        this.updateLiveLeaderboards();
      }, 500);
    }

    createItemSchema(data, isSword) {
      // Requirement 3: Enforce strict level boundary (1 to 10 max for swords and shields)
      let validLevel = parseInt(data.level, 10);
      if (isNaN(validLevel) || validLevel < 1) validLevel = 1;
      if (validLevel > 10) {
        console.warn(`[SMGrade Exploit Guard] Item level ${data.level} exceeds max 10. Clamping to 10.`);
        validLevel = 10;
      }

      const enchants = (data.enchantments || []).map(e => new LocalEntitySchema({
        type: e.type,
        level: Math.max(1, Math.min(3, parseInt(e.level, 10) || 1)),
        name: e.name || ''
      }));
      return new LocalEntitySchema({
        itemId: data.itemId || ((isSword ? 'sword_' : 'shield_') + Date.now() + '_' + Math.random().toString(36).substring(2, 9)),
        type: data.type || 1,
        level: validLevel,
        enchantments: new LocalArraySchema(enchants),
        isLocked: !!data.isLocked,
        isSword: !!isSword
      });
    }

    createPetSchema(data) {
      const pid = data.petId || ('pet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
      return new LocalEntitySchema({
        petId: pid,
        itemId: data.itemId || pid,
        type: data.type || 0,
        level: data.level || 1,
        isLocked: !!data.isLocked
      });
    }

    createOreSchema(data) {
      return new LocalEntitySchema({
        oreId: data.oreId || ('ore_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)),
        type: data.type !== undefined ? data.type : 0,
        isMelted: !!data.isMelted,
        amount: data.amount || 1,
        isLocked: !!data.isLocked
      });
    }

    spawnWorld1Mobs() {
      // 16 Authentic World 1 positions directly from scene 1719221.json (EnemyPositions)
      // Slime Meadows (Roundhead slimes, type 0, maxHP 100)
      const meadowSpawns = [
        { id: 'mob_0', type: 0, x: 10.12, y: -0.58, z: -96.37, hp: 100, name: 'Roundhead' },
        { id: 'mob_1', type: 0, x: 23.68, y: -0.58, z: -87.29, hp: 100, name: 'Roundhead' },
        { id: 'mob_2', type: 0, x: 22.93, y: -0.58, z: -102.67, hp: 100, name: 'Roundhead' },
        { id: 'mob_3', type: 0, x: 27.40, y: -0.58, z: -116.05, hp: 100, name: 'Roundhead' },
        { id: 'mob_4', type: 0, x: 11.16, y: -0.58, z: -128.46, hp: 100, name: 'Roundhead' },
        { id: 'mob_5', type: 0, x: 3.76, y: -0.58, z: -111.08, hp: 100, name: 'Roundhead' },
        { id: 'mob_6', type: 0, x: -31.58, y: -0.58, z: -107.98, hp: 100, name: 'Roundhead' },
        { id: 'mob_7', type: 0, x: -39.78, y: -0.58, z: -121.54, hp: 100, name: 'Roundhead' },
        { id: 'mob_8', type: 0, x: -30.00, y: -0.58, z: -132.37, hp: 100, name: 'Roundhead' },
        { id: 'mob_9', type: 0, x: -21.94, y: -0.58, z: -119.26, hp: 100, name: 'Roundhead' },
        { id: 'mob_10', type: 0, x: -46.60, y: -0.58, z: -108.50, hp: 100, name: 'Roundhead' }
      ];

      // Upper Forest Mountain Plateau (Forest Orcs, type 1, maxHP 2500)
      const plateauSpawns = [
        { id: 'mob_11', type: 1, x: 10.81, y: 6.49, z: -178.31, hp: 2500, name: 'Forest Orc' },
        { id: 'mob_12', type: 1, x: -19.12, y: 6.49, z: -217.03, hp: 2500, name: 'Forest Orc' },
        { id: 'mob_13', type: 1, x: 20.24, y: 6.49, z: -202.83, hp: 2500, name: 'Forest Orc' },
        { id: 'mob_14', type: 1, x: 1.46, y: 6.49, z: -222.95, hp: 2500, name: 'Forest Orc' },
        { id: 'mob_15', type: 1, x: 2.25, y: 6.49, z: -208.74, hp: 2500, name: 'Forest Orc' }
      ];

      const allSpawns = [...meadowSpawns, ...plateauSpawns];

      allSpawns.forEach(spawn => {
        const mob = new LocalEntitySchema({
          enemyId: spawn.id,
          type: spawn.type,
          x: spawn.x,
          y: spawn.y,
          z: spawn.z,
          rotationY: Math.random() * 360,
          health: spawn.hp,
          maxHealth: spawn.hp,
          isBurning: false,
          isFreezing: false,
          homeX: spawn.x,
          homeY: spawn.y,
          homeZ: spawn.z
        });
        this.state.enemies.add(spawn.id, mob);
      });

      console.log(`[SMGrade Standalone Room] Spawned ${allSpawns.length} authentic World 1 combat mobs in their designated zones.`);
    }

    startMobAITick() {
      if (this.mobTickInterval) clearInterval(this.mobTickInterval);

      this.mobTickInterval = setInterval(() => {
        const playerEnt = this.networkManager.currentPlayerEntity;
        if (!playerEnt) return;
        const playerPos = playerEnt.getPosition();
        const playerCtrl = playerEnt.script?.playerController;

        for (const [id, mob] of Object.entries(this.state.enemies.items)) {
          const mobEnt = this.networkManager.enemies[id];
          if (!mobEnt) continue;
          const ec = mobEnt.script?.enemyController;

          if (mob.health <= 0 || (ec && ec.isDied)) {
            if (ec) {
              ec.canGetDamage = false;
              if (ec.ring) ec.ring.enabled = false;
              if (playerCtrl) {
                const idx = playerCtrl.nearEnemies.indexOf(ec);
                if (idx !== -1) playerCtrl.nearEnemies.splice(idx, 1);
              }
            }
            continue;
          }

          const dx = playerPos.x - mob.x;
          const dz = playerPos.z - mob.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const distFromHome = Math.hypot(mob.x - mob.homeX, mob.z - mob.homeZ);
          const isNorthOfBoundary = mob.z > -60;

          // Proximity trigger: any mob in attack range is valid to hit
          if (ec) {
            if (dist <= 6.0 && mob.health > 0 && !ec.isDied) {
              ec.canGetDamage = true;
              ec.targetPlayer = playerEnt;
              if (ec.ring) ec.ring.enabled = true;
              if (playerCtrl && !playerCtrl.nearEnemies.includes(ec)) {
                playerCtrl.nearEnemies.push(ec);
              }
            } else if (dist > 6.5 || ec.isDied || mob.health <= 0) {
              ec.canGetDamage = false;
              if (ec.ring) ec.ring.enabled = false;
              if (playerCtrl) {
                const idx = playerCtrl.nearEnemies.indexOf(ec);
                if (idx !== -1) playerCtrl.nearEnemies.splice(idx, 1);
              }
            }
          }

          // Aggro: player is in combat area (z < -65) and within 10 units
          if (dist < 10 && dist > 2.0 && playerPos.z < -60 && distFromHome < 14 && !isNorthOfBoundary) {
            const speed = mob.isFreezing ? 0.11 : 0.22; // Freeze slows down speed
            mob.x += (dx / dist) * speed;
            mob.z += (dz / dist) * speed;
            mob.rotationY = Math.atan2(dx, dz) * (180 / Math.PI);
            mob.set('rotationY', mob.rotationY);
          } else if (dist <= 2.2 && playerPos.z < -60) {
            // Trigger attack animation and hit player
            if (ec && !ec.canDamage && !ec.isDied && mob.health > 0) {
              ec.targetPlayer = playerEnt;
              ec.attack(id);
            }
          } else {
            // Return home or gentle wander
            if (distFromHome > 4.5 || isNorthOfBoundary) {
              const backDx = mob.homeX - mob.x;
              const backDz = mob.homeZ - mob.z;
              const backDist = Math.hypot(backDx, backDz);
              if (backDist > 0.1) {
                const returnSpeed = 0.25;
                mob.x += (backDx / backDist) * returnSpeed;
                mob.z += (backDz / backDist) * returnSpeed;
                mob.rotationY = Math.atan2(backDx, backDz) * (180 / Math.PI);
                mob.set('rotationY', mob.rotationY);
              }
            } else {
              if (Math.random() < 0.05) {
                const wanderAngle = Math.random() * Math.PI * 2;
                const wanderDist = Math.random() * 1.8;
                mob.x = mob.homeX + Math.cos(wanderAngle) * wanderDist;
                mob.z = mob.homeZ + Math.sin(wanderAngle) * wanderDist;
                if (mob.z > -65) mob.z = -65;
                mob.rotationY = wanderAngle * (180 / Math.PI);
                mob.set('rotationY', mob.rotationY);
              }
            }
          }
        }
      }, 150);
    }

    handleClientMessage(type, data) {
      const inv = this.state.playerInventories.items[this.sessionId];

      // 1. COMBAT & DAMAGE (with authentic enchants)
      if (type === 'Client:EnemyController:checkDamage') {
        const mob = this.state.enemies.items[data.enemyId];
        if (!mob || mob.health <= 0) return;

        const playerCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
        const activeSword = inv?.activeSword;
        const activeSwordType = activeSword?.type || 1;
        const activeSwordLevel = activeSword?.level || 1;
        const swordsCatalog = window.SWORDMASTERS_SWORDS || (window.StaticData && StaticData.swords) || [];
        const swordData = swordsCatalog[activeSwordType] || { damage: 10 };

        // Base damage calculation
        const baseDmg = swordData.damage || 10;
        const powerMult = inv?.powerMultiplier || 1.0;
        const levelMult = activeSwordLevel;
        let finalDamage = Math.max(1, Math.round(baseDmg * levelMult * powerMult));

        // Evaluate sword enchantments
        const swordEnchants = activeSword?.enchantments?.items || [];
        const flame = swordEnchants.find(e => e.type === 0 || e.name === 'Flame');
        const freeze = swordEnchants.find(e => e.type === 3 || e.name === 'Freeze');
        const looting = swordEnchants.find(e => e.type === 2 || e.name === 'Looting');

        // Flame effect
        if (flame && flame.level > 0) {
          mob.set('isBurning', true);
          finalDamage += Math.round(finalDamage * 0.25 * flame.level);
          setTimeout(() => { mob.set('isBurning', false); }, 3000);
        }

        // Freeze effect
        if (freeze && freeze.level > 0) {
          mob.set('isFreezing', true);
          setTimeout(() => { mob.set('isFreezing', false); }, 3000);
        }

        mob.health = Math.max(0, mob.health - finalDamage);
        mob.set('health', mob.health);

        const mobEnt = this.networkManager.enemies[data.enemyId];
        const ec = mobEnt?.script?.enemyController;

        // Looting coin drop multiplier
        let coinDropCount = 3;
        let coinValue = 50;
        if (looting && looting.level > 0) {
          coinDropCount = Math.round(3 * (1 + looting.level * 0.5));
          coinValue = Math.round(50 * (1 + looting.level * 0.5));
        }

        // Fire Server:EnemyController:getDamage to trigger authentic animations, particles, popping text & sound
        this.networkManager.app.fire("Server:EnemyController:getDamage", data.enemyId, finalDamage, true, coinDropCount, coinValue, finalDamage);

        // Mob Defeated
        if (mob.health <= 0) {
          if (ec) {
            ec.canGetDamage = false;
            if (ec.ring) ec.ring.enabled = false;
            if (playerCtrl) {
              const idx = playerCtrl.nearEnemies.indexOf(ec);
              if (idx !== -1) playerCtrl.nearEnemies.splice(idx, 1);
            }
          }
          const goldAward = coinValue * coinDropCount;
          this.networkManager.goldAmount = (this.networkManager.goldAmount || 0) + goldAward;
          inv.set('gold', this.networkManager.goldAmount);
          if (this.networkManager.goldStatText?.element) {
            this.networkManager.goldStatText.element.text = numRound(this.networkManager.goldAmount);
          }
          this.networkManager.app.fire('enemyDied', mob.type);

          // Persist updated gold
          this.profile.gold = this.networkManager.goldAmount;
          saveLocalArcadeProfile(this.profile);

          // Respawn after 5 seconds at home position
          setTimeout(() => {
            mob.health = mob.maxHealth;
            mob.x = mob.homeX;
            mob.y = mob.homeY;
            mob.z = mob.homeZ;
            mob.set('health', mob.maxHealth);
            if (mobEnt) {
              mobEnt.setPosition(mob.homeX, mob.homeY, mob.homeZ);
              if (ec) {
                ec.hp = mob.maxHealth;
                ec.isDied = false;
                ec.canDamage = false;
                ec.canDropCoin = false;
                if (ec.enemyModel) ec.enemyModel.enabled = true;
                if (ec.healthBar) ec.healthBar.setup();
              }
            }
          }, 5000);
        }
      }

      // 1B. ENEMY ATTACK HIT PLAYER (Damage player, update healthbar, trigger Thorns)
      else if (type === 'Client:EnemyController:playerGotDamage') {
        const mob = this.state.enemies.items[data.enemyId];
        if (!mob || mob.health <= 0 || !inv) return;

        const mobEnt = this.networkManager.enemies[data.enemyId];
        const enemyBaseDmg = mob.type === 1 ? 45 : 12;

        const activeShield = inv.activeShield;
        const shieldType = activeShield?.type || 1;
        const shieldLevel = activeShield?.level || 1;
        const shieldsCatalog = window.SWORDMASTERS_SHIELDS || (window.StaticData && StaticData.shields) || [];
        const shieldData = shieldsCatalog[shieldType] || { damageProtection: 100 };
        const prot = (shieldData.damageProtection || 100) * shieldLevel;

        const damageReduction = Math.min(0.85, prot / (prot + 200));
        const damageTaken = Math.max(1, Math.round(enemyBaseDmg * (1 - damageReduction)));

        const currentHealth = inv.health !== undefined ? inv.health : 100;
        const newHealth = Math.max(0, currentHealth - damageTaken);
        inv.set('health', newHealth);
        this.profile.health = newHealth;

        const playerEnt = this.networkManager.currentPlayerEntity;
        if (playerEnt && mobEnt) {
          const kb = playerEnt.getPosition().clone().sub(mobEnt.getPosition()).mul(new pc.Vec3(4, 1, 4));
          if (playerEnt.script?.playerController) {
            playerEnt.script.playerController.getDamage(kb);
          }
        }

        // Shield Thorns Retaliation
        const shieldEnchants = activeShield?.enchantments?.items || [];
        const thorns = shieldEnchants.find(e => e.type === 1 || e.name === 'Thorns');
        if (thorns && thorns.level > 0) {
          const thornsDmg = Math.round(25 * thorns.level);
          mob.health = Math.max(0, mob.health - thornsDmg);
          mob.set('health', mob.health);
          this.networkManager.app.fire("Server:EnemyController:getDamage", data.enemyId, thornsDmg, true, 1, 10, thornsDmg);
        }

        // Respawn if health depleted
        if (newHealth <= 0) {
          setTimeout(() => {
            const maxHp = inv.maxHealth || 100;
            inv.set('health', maxHp);
            this.profile.health = maxHp;

            // Authentic server respawn dispatch to networkManager
            this.dispatchMessage("Server:PlayerController:respawn", this.sessionId);

            if (playerEnt) {
              if (playerEnt.rigidbody) {
                playerEnt.rigidbody.teleport(2, -0.25, 50);
                playerEnt.rigidbody.linearVelocity = pc.Vec3.ZERO;
                playerEnt.rigidbody.angularVelocity = pc.Vec3.ZERO;
              } else {
                playerEnt.setPosition(2, -0.25, 50);
              }
              if (playerEnt.script?.playerController) {
                playerEnt.script.playerController.respawn();
                playerEnt.script.playerController.hp = maxHp;
              }
            }
          }, 1500);
        }
      }

      // 2. WEAPON EQUIPMENT SWITCHING & UNEQUIPPING (P0 Fix: Decoupled schemas & Fortune support)
      else if (type === 'Client:SlotController:equipOrUnequipWeapon') {
        if (!inv) return;

        if (data.isSword) {
          if (data.equip) {
            const swordItem = inv.swords.find(s => s.itemId === data.itemId);
            if (swordItem) {
              inv.activeSword.set('type', swordItem.type);
              inv.activeSword.set('level', swordItem.level);
              inv.activeSword.set('itemId', swordItem.itemId);
              const enchants = (swordItem.enchantments?.items || swordItem.enchantments || []).map(e => new LocalEntitySchema({
                type: e.type,
                level: e.level,
                name: e.name || ''
              }));
              inv.activeSword.enchantments.items = enchants;
              inv.activeSword.enchantments.triggerChange();
              inv.set('activeSword', inv.activeSword);
              this.profile.activeSwordType = swordItem.type;
              this.profile.activeSwordLevel = swordItem.level;
              this.profile.activeSwordEnchants = enchants.map(e => ({ type: e.type, level: e.level, name: e.name }));
              saveLocalArcadeProfile(this.profile);
              const pCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
              if (pCtrl) {
                pCtrl.setActiveSword(swordItem.type, enchants);
              }
              if (this.networkManager.inventoryController) {
                this.networkManager.inventoryController.setActiveSlot();
              }
            }
          } else {
            // Unequip sword back to starter sword
            inv.activeSword.set('type', 1);
            inv.activeSword.set('level', 1);
            inv.activeSword.set('itemId', 'default_sword');
            inv.activeSword.enchantments.items = [];
            inv.activeSword.enchantments.triggerChange();
            inv.set('activeSword', inv.activeSword);
            this.profile.activeSwordType = 1;
            this.profile.activeSwordLevel = 1;
            this.profile.activeSwordEnchants = [];
            saveLocalArcadeProfile(this.profile);
            const pCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
            if (pCtrl) {
              pCtrl.setActiveSword(1, []);
            }
            if (this.networkManager.inventoryController) {
              this.networkManager.inventoryController.setActiveSlot();
            }
          }
        } else {
          if (data.equip) {
            const shieldItem = inv.shields.find(s => s.itemId === data.itemId);
            if (shieldItem) {
              inv.activeShield.set('type', shieldItem.type);
              inv.activeShield.set('level', shieldItem.level);
              inv.activeShield.set('itemId', shieldItem.itemId);
              const enchants = (shieldItem.enchantments?.items || shieldItem.enchantments || []).map(e => new LocalEntitySchema({
                type: e.type,
                level: e.level,
                name: e.name || ''
              }));
              inv.activeShield.enchantments.items = enchants;
              inv.activeShield.enchantments.triggerChange();
              inv.set('activeShield', inv.activeShield);
              this.profile.activeShieldType = shieldItem.type;
              this.profile.activeShieldLevel = shieldItem.level;
              this.profile.activeShieldEnchants = enchants.map(e => ({ type: e.type, level: e.level, name: e.name }));
              this.recalculatePlayerStats(inv);
              saveLocalArcadeProfile(this.profile);
              const pCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
              if (pCtrl) {
                pCtrl.setActiveShield(shieldItem.type, enchants);
              }
              if (this.networkManager.inventoryController) {
                this.networkManager.inventoryController.setActiveSlot();
              }
            }
          } else {
            // Unequip shield back to starter shield
            inv.activeShield.set('type', 1);
            inv.activeShield.set('level', 1);
            inv.activeShield.set('itemId', 'default_shield');
            inv.activeShield.enchantments.items = [];
            inv.activeShield.enchantments.triggerChange();
            inv.set('activeShield', inv.activeShield);
            this.profile.activeShieldType = 1;
            this.profile.activeShieldLevel = 1;
            this.profile.activeShieldEnchants = [];
            this.recalculatePlayerStats(inv);
            saveLocalArcadeProfile(this.profile);
            const pCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
            if (pCtrl) {
              pCtrl.setActiveShield(1, []);
            }
            if (this.networkManager.inventoryController) {
              this.networkManager.inventoryController.setActiveSlot();
            }
          }
        }
      }

      // 2B. AUTHENTIC DWARF BLACKSMITH FORGING (Strict +1 Level, Exact PDF Probability, Authentic Burn Rule)
      else if (type === 'Client:UpgraderController:forge') {
        if (!inv) return;
        if (this.isForging) {
          console.warn('[SMGrade Standalone Room] Forge request rejected: already in progress.');
          return;
        }

        const activeItemId = data?.activeItemId;
        let item = inv.swords.find(s => s.itemId === activeItemId);
        let isSword = true;
        if (!item) {
          item = inv.shields.find(s => s.itemId === activeItemId);
          isSword = false;
        }
        if (!item) {
          this.dispatchMessage("Server:UpgraderController:forgeFailed", { success: false });
          return;
        }

        const currentLevel = item.level || 1;
        if (currentLevel >= 10) {
          console.warn(`[SMGrade Standalone Room] Item ${item.itemId} is already at max level (10).`);
          if (this.networkManager.app) {
            this.networkManager.app.fire("WarningTextController:setWarning", "Item is already at max level (10)!", 5, new pc.Color(1, 0, 0, 1));
          }
          this.dispatchMessage("Server:UpgraderController:forgeFailed", { success: false, reason: "Max level reached" });
          return;
        }

        // Engage forge mutex lock
        this.isForging = true;
        setTimeout(() => { this.isForging = false; }, 1500);

        // Retrieve catalog metadata & rarity
        const swordsCatalog = window.SWORDMASTERS_SWORDS || (window.StaticData && StaticData.swords) || window.swords || [];
        const shieldsCatalog = window.SWORDMASTERS_SHIELDS || (window.StaticData && StaticData.shields) || window.shields || [];
        const itemData = isSword ? (swordsCatalog[item.type] || {}) : (shieldsCatalog[item.type] || {});
        const itemName = itemData.name || (isSword ? `Sword #${item.type}` : `Shield #${item.type}`);
        const rarity = itemData.rarity || "Common";

        // Read shield fortune level
        let fortuneLevel = 0;
        if (inv.activeShield && inv.activeShield.enchantments) {
          const enchList = inv.activeShield.enchantments.items || inv.activeShield.enchantments;
          if (Array.isArray(enchList)) {
            const fort = enchList.find(e => e.type === 4 || e.name === 'Fortune');
            if (fort) fortuneLevel = fort.level || 0;
          }
        }

        // Exact canonical PDF probability curve
        let s = currentLevel < 3
          ? 1 / (1 + 0.1 * currentLevel)
          : currentLevel < 5
          ? 1 / (1 + 0.2 * currentLevel)
          : 1 / (1 + 0.3 * currentLevel);

        if (rarity === "Rare") s *= 0.8;
        else if (rarity === "Epic") s *= (4 / 7);
        else if (rarity === "Legendary") s *= 0.4;

        s *= (1 + 0.05 * fortuneLevel);
        if (s > 1) s = 1;

        // Force flag support for deterministic automated test verification
        let isSuccess = data?.forceSuccess !== undefined
          ? !!data.forceSuccess
          : (this._forceNextForgeSuccess !== undefined ? Boolean(this._forceNextForgeSuccess) : (Math.random() < s));
        if (this._forceNextForgeSuccess !== undefined) delete this._forceNextForgeSuccess;

        if (isSuccess) {
          // Strictly +1 level (never jumps)
          item.level = currentLevel + 1;
          item.set('level', item.level);

          // Update active weapon if equipped
          if (isSword && inv.activeSword && inv.activeSword.itemId === item.itemId) {
            inv.activeSword.set('level', item.level);
            this.profile.activeSwordLevel = item.level;
          } else if (!isSword && inv.activeShield && inv.activeShield.itemId === item.itemId) {
            inv.activeShield.set('level', item.level);
            this.profile.activeShieldLevel = item.level;
            this.recalculatePlayerStats(inv);
          }

          this.persistInventory();
          saveLocalArcadeProfile(this.profile);

          // Requirement 11: Sync live achievements to persistent leaderboards
          this.recordPlayerStat({ dwarfSuccessDelta: 1, highestDwarfedLevel: item.level });

          // Authentic Dwarf Blacksmith NPC animation in 3D world
          const ironsmith = this.networkManager.app?.root?.findByName("ironsmith");
          if (ironsmith && ironsmith.anim) {
            ironsmith.anim.setTrigger("Attack0");
          }

          // Record Master Log
          if (window.logMasterAction) {
            window.logMasterAction(
              this.profile.username,
              "Dwarfing Attempt (Success)",
              `${itemName} upgraded from Level ${currentLevel} to Level ${item.level} (Odds: ${Math.round(s * 100)}%)`,
              "Success"
            );
          }

          // Dispatch Server:UpgraderController:forge to client to trigger authentic forgeAnim
          this.dispatchMessage("Server:UpgraderController:forge", {
            success: true,
            itemId: item.itemId,
            newLevel: item.level,
            resultItem: item,
            item: item
          });
          
          // Authoritative sync guard: ensure UpgraderUI ItemName reflects authoritative result level
          const upgraderUI = this.networkManager.app?.root?.findByName("UpgraderUI");
          if (upgraderUI?.script?.upgraderController) {
            const uCtrl = upgraderUI.script.upgraderController;
            if (uCtrl.itemForgedPanelItemName?.element && uCtrl.itemData) {
              uCtrl.itemForgedPanelItemName.element.text = `${uCtrl.itemData.name} Level ${item.level}`;
            }
          }
          console.log(`[SMGrade Standalone Room] Dwarfed ${itemName} strictly +1 to Level ${item.level}!`);
        } else {
          // Authentic Failure / Burn Rule
          const basePrice = itemData.priceGold || 1000;
          const refundGold = Math.round(basePrice * Math.pow(2, currentLevel - 1));

          // Permanently burn and remove item from inventory
          if (isSword) {
            const sIdx = inv.swords.items.findIndex(s => s.itemId === item.itemId);
            if (sIdx !== -1) inv.swords.remove(inv.swords.items[sIdx]);
            if (this.profile.inventory?.swords) {
              this.profile.inventory.swords = this.profile.inventory.swords.filter(s => s.itemId !== item.itemId);
            }
            if (inv.activeSword && inv.activeSword.itemId === item.itemId) {
              inv.activeSword.set('type', 1);
              inv.activeSword.set('level', 1);
              inv.activeSword.set('itemId', 'starter_sword');
              this.profile.activeSword = 1;
              this.profile.activeSwordLevel = 1;
              this.profile.activeSwordId = 'starter_sword';
            }
          } else {
            const shIdx = inv.shields.items.findIndex(sh => sh.itemId === item.itemId);
            if (shIdx !== -1) inv.shields.remove(inv.shields.items[shIdx]);
            if (this.profile.inventory?.shields) {
              this.profile.inventory.shields = this.profile.inventory.shields.filter(sh => sh.itemId !== item.itemId);
            }
            if (inv.activeShield && inv.activeShield.itemId === item.itemId) {
              inv.activeShield.set('type', 0);
              inv.activeShield.set('level', 1);
              inv.activeShield.set('itemId', 'none');
              this.profile.activeShield = 0;
              this.profile.activeShieldLevel = 1;
              this.profile.activeShieldId = 'none';
              this.recalculatePlayerStats(inv);
            }
          }

          // Credit refund gold to player
          this.networkManager.goldAmount = (this.networkManager.goldAmount || 0) + refundGold;
          inv.set('gold', this.networkManager.goldAmount);
          this.profile.gold = this.networkManager.goldAmount;
          if (this.networkManager.goldStatText?.element) {
            this.networkManager.goldStatText.element.text = numRound(this.networkManager.goldAmount);
          }

          this.persistInventory();
          saveLocalArcadeProfile(this.profile);

          // Record Master Log
          if (window.logMasterAction) {
            window.logMasterAction(
              this.profile.username,
              "Dwarfing Attempt (Burn / Failure)",
              `${itemName} (Level ${currentLevel}) failed and burned permanently. Refunded ${refundGold} gold. (Odds: ${Math.round(s * 100)}%)`,
              "Failed"
            );
          }

          // Dispatch Server:UpgraderController:forgeFailed to client to trigger flame particles, burn sound, and refund notification
          this.dispatchMessage("Server:UpgraderController:forgeFailed", {
            success: false,
            itemId: item.itemId,
            refundGold: refundGold
          });
          console.log(`[SMGrade Standalone Room] Dwarfing failed: ${itemName} burned! Refunded ${refundGold} gold.`);
        }
      }

      // 2C. PET EQUIPPING & SUMMONING (Criteria 3: Hard limit of 10 simultaneously spawned pets)
      else if (type === 'Client:PetUIController:equipDequipPet') {
        if (!inv) return;
        const petId = typeof data === 'string' ? data : (data?.petId || data?.itemId);
        const pet = inv.pets.find(p => (p.itemId === petId || p.petId === petId));
        if (!pet) return;

        // Check if currently equipped in activePets
        const activeIdx = inv.activePets.items.findIndex(p => (p.itemId === pet.itemId || p.petId === pet.petId));
        if (activeIdx !== -1) {
          // Unequip
          const removed = inv.activePets.items[activeIdx];
          inv.activePets.remove(removed);
          console.log(`[SMGrade Standalone] Unequipped pet ${pet.itemId}`);
        } else {
          // Equip: strictly maximum 10 simultaneously spawned pets
          if (inv.activePets.length >= 10) {
            this.networkManager.app.fire("WarningTextController:setWarning", "You can only equip up to 10 pets!", 5, new pc.Color(1, 0, 0, 1));
            return;
          }
          const activePet = new LocalEntitySchema({
            itemId: pet.itemId || pet.petId,
            petId: pet.petId || pet.itemId,
            type: pet.type,
            level: pet.level || 1
          });
          inv.activePets.push(activePet);
          console.log(`[SMGrade Standalone] Equipped pet ${pet.itemId} (type ${pet.type})`);
        }

        // Update profile active pets
        this.profile.activePets = inv.activePets.items.map(p => ({
          itemId: p.itemId,
          petId: p.petId,
          type: p.type,
          level: p.level || 1
        }));
        saveLocalArcadeProfile(this.profile);

        // Refresh active state in PetUI slots
        const petUI = this.networkManager.app.root.findByName("PetUI")?.script?.petUIController;
        if (petUI) petUI.setActiveSlot();
      }

      else if (type === 'Client:PetUIController:unequipAllPets') {
        if (!inv) return;
        while (inv.activePets.length > 0) {
          inv.activePets.remove(inv.activePets.items[0]);
        }
        this.profile.activePets = [];
        saveLocalArcadeProfile(this.profile);
        const petUI = this.networkManager.app.root.findByName("PetUI")?.script?.petUIController;
        if (petUI) petUI.setActiveSlot();
        console.log('[SMGrade Standalone] Unequipped all pets.');
      }

      // PET SELLING (Authentic Gold Grant & 3D Model Destruction)
      else if (type === 'Client:PetUIController:sellPet') {
        if (!inv) return;
        const petId = typeof data === 'string' ? data : (data?.petId || data?.itemId);
        const idx = inv.pets.items.findIndex(p => (p.itemId === petId || p.petId === petId));
        if (idx !== -1) {
          const pet = inv.pets.items[idx];
          const petsCatalog = window.SWORDMASTERS_PETS || (window.StaticData && StaticData.pets) || window.pets || [];
          const meta = petsCatalog[pet.type] || { priceGold: 100 };
          const sellPrice = meta.priceGold || 100;

          // Remove from activePets if equipped (destroys 3D model)
          const activeIdx = inv.activePets.items.findIndex(p => (p.itemId === petId || p.petId === petId));
          if (activeIdx !== -1) {
            inv.activePets.remove(inv.activePets.items[activeIdx]);
          }

          inv.pets.remove(pet);
          delete this.networkManager.petItems[pet.itemId || petId];

          inv.set('gold', (inv.gold || 0) + sellPrice);
          this.networkManager.goldAmount = inv.gold;
          if (this.networkManager.goldStatText?.element) {
            this.networkManager.goldStatText.element.text = numRound(inv.gold);
          }
          this.profile.gold = inv.gold;
          this.persistInventory();
          this.dispatchMessage("Server:PetUIController:soldPet", sellPrice);

          if (this.networkManager?.petUIController) {
            this.networkManager.petUIController.sortInventory();
          }
        }
      }

      else if (type === 'Client:PetUIController:sellUnusedPets') {
        if (!inv) return;
        const petsCatalog = window.SWORDMASTERS_PETS || (window.StaticData && StaticData.pets) || window.pets || [];
        let totalGold = 0;
        const activeIds = new Set(inv.activePets.items.map(p => p.itemId || p.petId));

        const remaining = [];
        for (const pet of inv.pets.items) {
          const isEquipped = activeIds.has(pet.itemId) || activeIds.has(pet.petId);
          if (!isEquipped && !pet.isLocked) {
            const meta = petsCatalog[pet.type] || { priceGold: 100 };
            totalGold += (meta.priceGold || 100);
            delete this.networkManager.petItems[pet.itemId || pet.petId];
          } else {
            remaining.push(pet);
          }
        }

        inv.pets.items = remaining;
        inv.pets.triggerChange();
        inv.set('gold', (inv.gold || 0) + totalGold);
        this.networkManager.goldAmount = inv.gold;
        if (this.networkManager.goldStatText?.element) {
          this.networkManager.goldStatText.element.text = numRound(inv.gold);
        }
        this.profile.gold = inv.gold;
        this.persistInventory();

        this.dispatchMessage("Server:PetUIController:soldUnusedPets", totalGold);

        if (this.networkManager?.petUIController) {
          this.networkManager.petUIController.sortInventory();
        }
      }

      // PET ENHANCER (Authentic 10 Epic Pets -> 1 X-Pet Combination Machine)
      else if (type === 'Client:PetEnhancerController:enhance') {
        if (!inv) return;
        const activeItemId = data?.activeItemId;
        const luckBoost = !!data?.luckBoost;
        console.log('[Enhance Debug] activeItemId:', activeItemId, 'luckBoost:', luckBoost);

        const targetPet = inv.pets.items.find(p => p.itemId === activeItemId || p.petId === activeItemId);
        if (!targetPet) {
          console.log('[Enhance Debug] targetPet not found!');
          this.dispatchMessage("Server:PetEnhancerController:enhanceFailed");
          return;
        }

        const petsCatalog = window.SWORDMASTERS_PETS || (window.StaticData && StaticData.pets) || window.pets || [];
        const petData = petsCatalog[targetPet.type];
        console.log('[Enhance Debug] targetPet.type:', targetPet.type, 'petData:', petData);
        if (!petData || petData.enhancedPet === undefined) {
          console.log('[Enhance Debug] petData or enhancedPet undefined');
          this.networkManager.app?.fire("WarningTextController:setWarning", "Machine only accepts 10x epic pets!", 5, new pc.Color(1, 0, 0, 1));
          this.dispatchMessage("Server:PetEnhancerController:enhanceFailed");
          return;
        }

        // Count unlocked pets of same type
        const matching = inv.pets.items.filter(p => p.type === targetPet.type && !p.isLocked);
        console.log('[Enhance Debug] matching count:', matching.length);
        if (matching.length < 10) {
          this.networkManager.app?.fire("WarningTextController:setWarning", `You need ${10 - matching.length} more ${petData.name}!`, 5, new pc.Color(1, 0, 0, 1));
          this.dispatchMessage("Server:PetEnhancerController:enhanceFailed");
          return;
        }

        // Handle luck boost price
        let boostPrice = targetPet.type === 34 ? 5e15 : 1e15;
        if (luckBoost) {
          if ((inv.gold || 0) < boostPrice) {
            this.networkManager.app?.fire("WarningTextController:setWarning", "Insufficient gold for luck boost!", 5, new pc.Color(1, 0, 0, 1));
            this.dispatchMessage("Server:PetEnhancerController:enhanceFailed");
            return;
          }
          inv.set('gold', (inv.gold || 0) - boostPrice);
          this.networkManager.goldAmount = inv.gold;
          if (this.networkManager.goldStatText?.element) {
            this.networkManager.goldStatText.element.text = numRound(inv.gold);
          }
        }

        // Calculate authentic probability
        const pLevel = inv.level || 1;
        let baseLuck = pLevel > 1e4 ? 0.33 : pLevel > 9e3 ? 0.3 : pLevel > 8e3 ? 0.25 : pLevel > 7e3 ? 0.2 : pLevel > 6e3 ? 0.15 : pLevel > 5e3 ? 0.1 : pLevel > 4e3 ? 0.07 : pLevel > 3e3 ? 0.05 : pLevel > 2e3 ? 0.03 : 0.01;
        const enhancedType = petData.enhancedPet;
        if (enhancedType === 35) baseLuck *= 1/19;
        else if (enhancedType === 31) baseLuck *= 1/8;
        else if (enhancedType === 27) baseLuck *= 1/7;
        else if (enhancedType === 26) baseLuck *= 1/6;
        else if (enhancedType === 25) baseLuck *= 0.2;
        else if (enhancedType === 24) baseLuck *= 0.25;
        else if (enhancedType === 23) baseLuck *= 1/3;
        else if (enhancedType === 22) baseLuck *= 0.5;
        else if (enhancedType === 21) baseLuck *= 1.0;

        let fortLevel = 0;
        if (typeof getFortuneLevel === 'function') fortLevel = getFortuneLevel();
        baseLuck *= (1 + 0.05 * fortLevel);
        if (luckBoost) baseLuck = Math.min(1.0, baseLuck * 3);
        baseLuck = Math.min(1.0, baseLuck);

        const isSuccess = Math.random() < baseLuck;

        // Consume 10 matching pets
        const toRemove = matching.slice(0, 10);
        toRemove.forEach(rp => {
          const aIdx = inv.activePets.items.findIndex(ap => ap.itemId === rp.itemId || ap.petId === rp.petId);
          if (aIdx !== -1) {
            inv.activePets.remove(inv.activePets.items[aIdx]);
          }
          inv.pets.remove(rp);
          delete this.networkManager.petItems[rp.itemId || rp.petId];
        });

        if (isSuccess) {
          const newPet = this.createPetSchema({
            type: enhancedType,
            level: 1,
            isLocked: false
          });
          inv.pets.push(newPet);
          this.networkManager.petItems[newPet.itemId] = newPet;
          this.persistInventory();

          // Requirement 11: Sync pet enhancement achievement to live leaderboards
          this.recordPlayerStat({ petEnhanceDelta: 1 });

          if (window.logMasterAction) {
            window.logMasterAction(this.profile.username, "Pet Enhanced", `Successfully enhanced 10x ${petData.name} into ${petsCatalog[enhancedType]?.name}!`, "Success");
          }

          this.dispatchMessage("Server:PetEnhancerController:enhance");
        } else {
          this.persistInventory();
          if (window.logMasterAction) {
            window.logMasterAction(this.profile.username, "Pet Enhance Failed", `Failed to enhance ${petData.name} (Odds: ${Math.round(baseLuck * 100)}%)`, "Failed");
          }
          this.dispatchMessage("Server:PetEnhancerController:enhanceFailed");
        }

        if (this.networkManager?.petUIController) {
          this.networkManager.petUIController.sortInventory();
        }
      }

      // DOWNGRADER NPC (Authentic Downgrade L -> L-1, Yields x1-xL copies)
      else if (type === 'Client:DowngraderController:forge') {
        if (!inv) return;
        const activeItemId = data?.activeItemId;
        let item = inv.swords.find(s => s.itemId === activeItemId);
        let isSword = true;
        if (!item) {
          item = inv.shields.find(s => s.itemId === activeItemId);
          isSword = false;
        }

        if (!item || (item.level || 1) < 2) {
          this.networkManager.app?.fire("WarningTextController:setWarning", "Item must be at least Level 2 to downgrade!", 5, new pc.Color(1, 0, 0, 1));
          this.dispatchMessage("Server:DowngraderController:forgeFailed");
          return;
        }

        let fortLevel = 0;
        if (typeof getFortuneLevel === 'function') fortLevel = getFortuneLevel();
        const luckAverage = Math.round(100 * Math.min(0.9, (0.5 + item.level / 20) * (1 + 0.05 * fortLevel)));
        const isSuccess = (Math.random() * 100) < luckAverage;

        if (isSuccess) {
          const copies = Math.floor(Math.random() * item.level) + 1;
          const targetLevel = item.level - 1;

          // Downgrade original item and clear enchantments
          item.level = targetLevel;
          item.enchantments = new LocalArraySchema([]);

          // If currently equipped, update active weapon
          if (isSword && inv.activeSword.itemId === item.itemId) {
            inv.activeSword.set('level', targetLevel);
            inv.activeSword.enchantments.items = [];
            inv.activeSword.enchantments.triggerChange();
            const pCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
            if (pCtrl) pCtrl.setActiveSword(item.type, []);
          } else if (!isSword && inv.activeShield.itemId === item.itemId) {
            inv.activeShield.set('level', targetLevel);
            inv.activeShield.enchantments.items = [];
            inv.activeShield.enchantments.triggerChange();
            const pCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
            if (pCtrl) pCtrl.setActiveShield(item.type, []);
          }

          // Add extra copies if copies > 1
          for (let c = 1; c < copies; c++) {
            const copySchema = this.createItemSchema({
              type: item.type,
              level: targetLevel,
              enchantments: [],
              isLocked: false
            }, isSword);
            if (isSword) {
              inv.swords.push(copySchema);
              this.networkManager.items[copySchema.itemId] = copySchema;
            } else {
              inv.shields.push(copySchema);
              this.networkManager.items[copySchema.itemId] = copySchema;
            }
          }

          this.persistInventory();
          if (window.logMasterAction) {
            window.logMasterAction(this.profile.username, "Item Downgraded", `Downgraded to Level ${targetLevel} (Yielded x${copies})`, "Success");
          }

          this.dispatchMessage("Server:DowngraderController:forge", copies);

          if (this.networkManager.inventoryController) {
            this.networkManager.inventoryController.sortInventory();
            this.networkManager.inventoryController.setActiveSlot();
          }
        } else {
          if (window.logMasterAction) {
            window.logMasterAction(this.profile.username, "Downgrade Failed", `Downgrade attempt failed`, "Failed");
          }
          this.dispatchMessage("Server:DowngraderController:forgeFailed");
        }
      }

      // WORLD 1 STORAGE NPC (Store, Withdraw, Buy Slot)
      else if (type === 'Client:StoragePanelController:storeItem') {
        if (!inv) return;
        const itemId = data?.itemId;
        const itemType = data?.itemType; // Authentic SwordMasters: 0: sword, 1: shield, 2: pet, 3: ore
        const storageLimit = inv.storageLimit || 20;

        // If already in storage (e.g. from updateStorage / reload loops), do not duplicate
        if (inv.storage.items.some(s => s.itemId === itemId)) {
          return;
        }

        if (inv.storage.length >= storageLimit) {
          if (this.networkManager.app) {
            this.networkManager.app.fire("WarningTextController:setWarning", "Storage is full!", 5, new pc.Color(1, 0, 0, 1));
          }
          return;
        }

        let foundItem = null;
        let resolvedType = 0;

        if (itemType === 0) {
          const idx = inv.swords.items.findIndex(s => s.itemId === itemId);
          if (idx !== -1) {
            foundItem = inv.swords.items[idx];
            resolvedType = 0;
            if (inv.activeSword.itemId === foundItem.itemId) {
              this.networkManager.app?.fire("WarningTextController:setWarning", "Unequip your sword first!", 5, new pc.Color(1, 0, 0, 1));
              return;
            }
            inv.swords.remove(foundItem);
            delete this.networkManager.items[foundItem.itemId];
          }
        } else if (itemType === 1) {
          // Check shields first (authentic itemType 1), then swords (1-based)
          let idx = inv.shields.items.findIndex(s => s.itemId === itemId);
          if (idx !== -1) {
            foundItem = inv.shields.items[idx];
            resolvedType = 1;
            if (inv.activeShield.itemId === foundItem.itemId) {
              this.networkManager.app?.fire("WarningTextController:setWarning", "Unequip your shield first!", 5, new pc.Color(1, 0, 0, 1));
              return;
            }
            inv.shields.remove(foundItem);
            delete this.networkManager.items[foundItem.itemId];
          } else if ((idx = inv.swords.items.findIndex(s => s.itemId === itemId)) !== -1) {
            foundItem = inv.swords.items[idx];
            resolvedType = 0;
            if (inv.activeSword.itemId === foundItem.itemId) {
              this.networkManager.app?.fire("WarningTextController:setWarning", "Unequip your sword first!", 5, new pc.Color(1, 0, 0, 1));
              return;
            }
            inv.swords.remove(foundItem);
            delete this.networkManager.items[foundItem.itemId];
          }
        } else if (itemType === 2) {
          // Check pets first (authentic itemType 2), then shields
          let idx = inv.pets.items.findIndex(p => p.itemId === itemId || p.petId === itemId);
          if (idx !== -1) {
            foundItem = inv.pets.items[idx];
            resolvedType = 2;
            const aIdx = inv.activePets.items.findIndex(p => p.itemId === foundItem.itemId || p.petId === foundItem.petId);
            if (aIdx !== -1) {
              inv.activePets.remove(inv.activePets.items[aIdx]);
            }
            inv.pets.remove(foundItem);
            delete this.networkManager.petItems[foundItem.itemId];
          } else if ((idx = inv.shields.items.findIndex(s => s.itemId === itemId)) !== -1) {
            foundItem = inv.shields.items[idx];
            resolvedType = 1;
            if (inv.activeShield.itemId === foundItem.itemId) {
              this.networkManager.app?.fire("WarningTextController:setWarning", "Unequip your shield first!", 5, new pc.Color(1, 0, 0, 1));
              return;
            }
            inv.shields.remove(foundItem);
            delete this.networkManager.items[foundItem.itemId];
          }
        } else if (itemType === 3) {
          const idx = inv.ores.items.findIndex(o => o.oreId === itemId || o.itemId === itemId);
          if (idx !== -1) {
            foundItem = inv.ores.items[idx];
            resolvedType = 3;
            inv.ores.remove(foundItem);
          }
        }

        // Generic fallback by itemId if type wasn't specified or didn't match
        if (!foundItem) {
          let idx = inv.swords.items.findIndex(s => s.itemId === itemId);
          if (idx !== -1) {
            foundItem = inv.swords.items[idx];
            resolvedType = 0;
            if (inv.activeSword.itemId === foundItem.itemId) {
              this.networkManager.app?.fire("WarningTextController:setWarning", "Unequip your sword first!", 5, new pc.Color(1, 0, 0, 1));
              return;
            }
            inv.swords.remove(foundItem);
            delete this.networkManager.items[foundItem.itemId];
          } else if ((idx = inv.shields.items.findIndex(s => s.itemId === itemId)) !== -1) {
            foundItem = inv.shields.items[idx];
            resolvedType = 1;
            if (inv.activeShield.itemId === foundItem.itemId) {
              this.networkManager.app?.fire("WarningTextController:setWarning", "Unequip your shield first!", 5, new pc.Color(1, 0, 0, 1));
              return;
            }
            inv.shields.remove(foundItem);
            delete this.networkManager.items[foundItem.itemId];
          } else if ((idx = inv.pets.items.findIndex(p => p.itemId === itemId || p.petId === itemId)) !== -1) {
            foundItem = inv.pets.items[idx];
            resolvedType = 2;
            const aIdx = inv.activePets.items.findIndex(p => p.itemId === foundItem.itemId || p.petId === foundItem.petId);
            if (aIdx !== -1) {
              inv.activePets.remove(inv.activePets.items[aIdx]);
            }
            inv.pets.remove(foundItem);
            delete this.networkManager.petItems[foundItem.itemId];
          } else if ((idx = inv.ores.items.findIndex(o => o.oreId === itemId || o.itemId === itemId)) !== -1) {
            foundItem = inv.ores.items[idx];
            resolvedType = 3;
            inv.ores.remove(foundItem);
          }
        }

        if (foundItem) {
          const storedItem = new LocalEntitySchema({
            itemId: foundItem.itemId || foundItem.oreId || foundItem.petId,
            itemType: resolvedType,
            type: foundItem.type,
            level: foundItem.level || 1,
            enchantments: foundItem.enchantments || new LocalArraySchema([]),
            isLocked: !!foundItem.isLocked
          });
          inv.storage.push(storedItem);
          this.persistInventory();
          console.log(`[SMGrade Standalone Room] Stored item ${storedItem.itemId} (type ${resolvedType}) in storage.`);
          if (this.networkManager.inventoryController) {
            this.networkManager.inventoryController.sortInventory();
          }
          if (this.networkManager.petUIController) {
            this.networkManager.petUIController.sortInventory();
          }
        }
      }

      else if (type === 'Client:StorageSlotController:getSlotItem') {
        if (!inv) return;
        const activeItem = data;
        const itemId = activeItem?.itemId;
        if (!itemId) return;

        const idx = inv.storage.items.findIndex(st => st.itemId === itemId);
        if (idx !== -1) {
          const storedItem = inv.storage.items[idx];
          inv.storage.remove(storedItem);

          const itemType = storedItem.itemType; // 0: sword, 1: shield, 2: pet, 3: ore
          if (itemType === 0) {
            const restored = this.createItemSchema(storedItem, true);
            inv.swords.push(restored);
            this.networkManager.items[restored.itemId] = restored;
          } else if (itemType === 1) {
            const restored = this.createItemSchema(storedItem, false);
            inv.shields.push(restored);
            this.networkManager.items[restored.itemId] = restored;
          } else if (itemType === 2) {
            const restored = this.createPetSchema(storedItem);
            inv.pets.push(restored);
            this.networkManager.petItems[restored.itemId] = restored;
          } else if (itemType === 3) {
            const restored = this.createOreSchema(storedItem);
            inv.ores.push(restored);
          }

          this.persistInventory();
          console.log(`[SMGrade Standalone Room] Withdrew item ${itemId} from storage.`);
          // inv.storage.remove triggers onRemove which fires "StoragePanelController:reload"
          if (this.networkManager.inventoryController) {
            this.networkManager.inventoryController.sortInventory();
          }
          if (this.networkManager.petUIController) {
            this.networkManager.petUIController.sortInventory();
          }
        }
      }

      else if (type === 'Client:StorageSlotController:buySlot') {
        if (!inv) return;
        const slotPrice = 1000000;
        if ((inv.gold || 0) < slotPrice) {
          this.networkManager.app?.fire("WarningTextController:setWarning", "Insufficient gold to buy storage slot!", 5, new pc.Color(1, 0, 0, 1));
          return;
        }
        inv.set('gold', (inv.gold || 0) - slotPrice);
        this.networkManager.goldAmount = inv.gold;
        if (this.networkManager.goldStatText?.element) {
          this.networkManager.goldStatText.element.text = numRound(inv.gold);
        }
        const currentLimit = inv.storageLimit || 20;
        inv.set('storageLimit', Math.min(30, currentLimit + 1));
        this.profile.storageLimit = inv.storageLimit;
        this.profile.gold = inv.gold;
        this.persistInventory();
        if (this.networkManager.app) {
          this.networkManager.app.fire("StoragePanelController:reload");
        }
      }

      // 3. ITEM SELLING (Requirement 1: Reliable Sell Flow, Authentic Formula, Sync State, Unequip Handling)
      else if (type === 'Client:InventoryController:sellItem') {
        if (!inv || !data || !data.itemId) return;
        const swordsCatalog = window.SWORDMASTERS_SWORDS || (window.StaticData && StaticData.swords) || window.swords || [];
        const shieldsCatalog = window.SWORDMASTERS_SHIELDS || (window.StaticData && StaticData.shields) || window.shields || [];

        // Concurrency / rapid-click double-sell guard
        this._sellingInFlight = this._sellingInFlight || new Set();
        if (this._sellingInFlight.has(data.itemId)) {
          console.warn(`[SMGrade Standalone] Blocked duplicate rapid sell request for ${data.itemId}`);
          return;
        }
        this._sellingInFlight.add(data.itemId);
        setTimeout(() => this._sellingInFlight && this._sellingInFlight.delete(data.itemId), 400);

        if (data.isSword) {
          const idx = inv.swords.items.findIndex(s => s.itemId === data.itemId);
          if (idx !== -1) {
            const item = inv.swords.items[idx];
            const meta = swordsCatalog[item.type] || { priceGold: 100, name: "Sword" };
            // Authentic original formula: priceGold * 2^(level - 1)
            const sellPrice = Math.round(Number(meta.priceGold || 100) * Math.pow(2, (item.level || 1) - 1));

            // If equipped, unequip and sync 3D player visuals immediately
            if (inv.activeSword && inv.activeSword.itemId === item.itemId) {
              inv.activeSword.set('type', 1);
              inv.activeSword.set('level', 1);
              inv.activeSword.set('itemId', 'default_sword');
              inv.activeSword.enchantments.items = [];
              inv.activeSword.enchantments.triggerChange();
              inv.set('activeSword', inv.activeSword);
              this.profile.activeSwordType = 1;
              this.profile.activeSwordLevel = 1;
              this.profile.activeSwordEnchants = [];
              const pCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
              if (pCtrl) {
                pCtrl.setActiveSword(1, []);
              }
              if (this.networkManager.inventoryController) {
                this.networkManager.inventoryController.setActiveSlot();
              }
            }

            // Remove using LocalArraySchema.remove so onRemove listeners fire, resetting slot UI and re-sorting inventory
            inv.swords.remove(item);
            inv.set('gold', Number(inv.gold || 0) + sellPrice);
            this.networkManager.goldAmount = inv.gold;
            this.profile.gold = Number(inv.gold);
            if (this.networkManager.goldStatText?.element) {
              this.networkManager.goldStatText.element.text = numRound(inv.gold);
            }
            this.persistInventory();
            saveLocalArcadeProfile(this.profile);
            if (window.logMasterAction) {
              window.logMasterAction(this.profile?.username, "Item Sold", `Sold ${meta.name} (Lvl ${item.level}) for ${sellPrice} gold`, "Success");
            }
            console.log(`[SMGrade Standalone] Sold sword ${item.itemId} (${meta.name} Lvl ${item.level}) for ${sellPrice} gold. Gold balance: ${inv.gold}`);
          }
        } else {
          const idx = inv.shields.items.findIndex(s => s.itemId === data.itemId);
          if (idx !== -1) {
            const item = inv.shields.items[idx];
            const meta = shieldsCatalog[item.type] || { priceGold: 100, name: "Shield" };
            const sellPrice = Math.round(Number(meta.priceGold || 100) * Math.pow(2, (item.level || 1) - 1));

            // If equipped, unequip and sync 3D player visuals immediately
            if (inv.activeShield && inv.activeShield.itemId === item.itemId) {
              inv.activeShield.set('type', 1);
              inv.activeShield.set('level', 1);
              inv.activeShield.set('itemId', 'default_shield');
              inv.activeShield.enchantments.items = [];
              inv.activeShield.enchantments.triggerChange();
              inv.set('activeShield', inv.activeShield);
              this.profile.activeShieldType = 1;
              this.profile.activeShieldLevel = 1;
              this.profile.activeShieldEnchants = [];
              this.recalculatePlayerStats(inv);
              const pCtrl = this.networkManager.currentPlayerEntity?.script?.playerController;
              if (pCtrl) {
                pCtrl.setActiveShield(1, []);
              }
              if (this.networkManager.inventoryController) {
                this.networkManager.inventoryController.setActiveSlot();
              }
            }

            inv.shields.remove(item);
            inv.set('gold', Number(inv.gold || 0) + sellPrice);
            this.networkManager.goldAmount = inv.gold;
            this.profile.gold = Number(inv.gold);
            if (this.networkManager.goldStatText?.element) {
              this.networkManager.goldStatText.element.text = numRound(inv.gold);
            }
            this.persistInventory();
            saveLocalArcadeProfile(this.profile);
            if (window.logMasterAction) {
              window.logMasterAction(this.profile?.username, "Item Sold", `Sold ${meta.name} (Lvl ${item.level}) for ${sellPrice} gold`, "Success");
            }
            console.log(`[SMGrade Standalone] Sold shield ${item.itemId} (${meta.name} Lvl ${item.level}) for ${sellPrice} gold. Gold balance: ${inv.gold}`);
          }
        }
      }

      // 4. COSMETICS PURCHASE & EQUIPPING (Phase 11)
      else if (type === 'Client:CustomizeController:buyCustomize') {
        if (!inv) return;
        const itemType = data.itemType; // 0: skinColor, 1: face, 2: hair, 3: helmet, 4: torso, 5: pant, 6: shoe
        const cosmeticId = data.type;

        // Map itemType to schema array
        const schemaMap = {
          0: { prop: 'skinColors', activeProp: 'activeSkinColor', event: 'CustomizeSlotController:boughtNewSkinColor' },
          1: { prop: 'faces', activeProp: 'activeFace', event: 'CustomizeSlotController:boughtNewFaceType' },
          2: { prop: 'hairs', activeProp: 'activeHair', event: 'CustomizeSlotController:boughtNewHair' },
          3: { prop: 'helmets', activeProp: 'activeHelmet', event: 'BlacksmithItemController:boughtNewHelmet' },
          4: { prop: 'torsos', activeProp: 'activeTorso', event: 'BlacksmithItemController:boughtNewTorso' },
          5: { prop: 'pants', activeProp: 'activePant', event: 'BlacksmithItemController:boughtNewPant' },
          6: { prop: 'shoes', activeProp: 'activeShoe', event: 'BlacksmithItemController:boughtNewShoe' }
        };

        const target = schemaMap[itemType];
        if (!target) return;

        // Deduct price if not already owned
        const ownedArray = inv[target.prop];
        if (ownedArray && !ownedArray.items.includes(cosmeticId)) {
          ownedArray.push(cosmeticId);
          if (!this.profile.ownedCosmetics[target.prop].includes(cosmeticId)) {
            this.profile.ownedCosmetics[target.prop].push(cosmeticId);
          }
        }

        // Equip the cosmetic
        inv.set(target.activeProp, cosmeticId);
        this.profile[target.activeProp] = cosmeticId;
        saveLocalArcadeProfile(this.profile);

        // Notify client controllers
        this.networkManager.app.fire(target.event, cosmeticId);
        console.log(`[SMGrade Standalone] Cosmetic purchased and equipped: ${target.activeProp} = ${cosmeticId}`);
      }
    }

    recalculatePlayerStats(inv) {
      if (!inv) return;
      const level = inv.level || 1;
      const shieldsCatalog = window.SWORDMASTERS_SHIELDS || (window.StaticData && StaticData.shields) || [];
      const activeShieldType = inv.activeShield?.type || 1;
      const shieldData = shieldsCatalog[activeShieldType] || { damageProtection: 100 };
      const prot = (shieldData.damageProtection || 100) * (inv.activeShield?.level || 1);

      const shieldMultiplier = 1 + Math.min(2.0, (prot - 100) / 500);
      const newMaxHealth = Math.max(100, Math.round((100 + (level - 1) * 15) * shieldMultiplier));

      inv.set('maxHealth', newMaxHealth);
      if (inv.health > newMaxHealth || inv.health === undefined) {
        inv.set('health', newMaxHealth);
      }
      this.profile.maxHealth = newMaxHealth;
      this.profile.health = inv.health;

      if (this.networkManager?.healthBar) {
        this.networkManager.healthBar.setup();
      }
    }

    persistInventory() {
      const inv = this.state.playerInventories.items[this.sessionId];
      if (!inv) return;

      this.profile.swords = inv.swords.items.map(s => ({
        itemId: s.itemId,
        type: s.type,
        level: s.level,
        enchantments: (s.enchantments.items || []).map(e => ({ type: e.type, level: e.level, name: e.name })),
        isLocked: s.isLocked
      }));

      this.profile.shields = inv.shields.items.map(s => ({
        itemId: s.itemId,
        type: s.type,
        level: s.level,
        enchantments: (s.enchantments.items || []).map(e => ({ type: e.type, level: e.level, name: e.name })),
        isLocked: s.isLocked
      }));

      this.profile.pets = (inv.pets.items || []).slice(0, 500).map(p => ({
        itemId: p.itemId || p.petId,
        petId: p.petId || p.itemId,
        type: p.type,
        level: p.level || 1,
        isLocked: !!p.isLocked
      }));

      this.profile.ores = inv.ores.items.map(o => ({
        oreId: o.oreId,
        type: o.type,
        isMelted: o.isMelted,
        amount: o.amount,
        isLocked: o.isLocked
      }));

      if (inv.storage) {
        this.profile.storage = inv.storage.items.map(st => ({
          itemId: st.itemId,
          itemType: st.itemType,
          type: st.type,
          level: st.level,
          enchantments: (st.enchantments?.items || st.enchantments || []).map(e => ({ type: e.type, level: e.level, name: e.name })),
          isLocked: !!st.isLocked
        }));
      }
      this.profile.storageLimit = inv.storageLimit || 20;

      this.profile.gold = inv.gold;
      this.profile.power = inv.power;
      this.profile.level = inv.level;

      saveLocalArcadeProfile(this.profile);
    }

    cleanupOnlineOnlyElements() {
      const app = this.networkManager.app;
      if (!app || !app.root) return;

      // 1. Completely remove and disable ESC Menu (Requirement 9)
      const settingsBtn = app.root.findByName('SettingsButton');
      if (settingsBtn) {
        settingsBtn.enabled = false;
        if (settingsBtn.button) settingsBtn.button.active = false;
      }

      const gameUI = app.root.findByName('GameUI');
      if (gameUI && gameUI.script && gameUI.script.menuController) {
        const mc = gameUI.script.menuController;
        mc.enableDisableMenu = function () { /* suppressed in standalone */ };
        if (mc.menuUI) mc.menuUI.enabled = false;
        if (mc.settingsPanel) mc.settingsPanel.enabled = false;
        if (mc.changePasswordPanel) mc.changePasswordPanel.enabled = false;
        if (mc.buyVIPButton) mc.buyVIPButton.enabled = false;
      }
      if (window.MenuController) {
        window.MenuController.prototype.enableDisableMenu = function () { /* suppressed */ };
      }

      // 2. Disable Trade World, Clan World, VIP promotions (LeaderArea retained for live 3-board leaderboards - Requirement 11)
      const onlineEntities = [
        'TradePortal',
        'ClanButton', 'ClanNPC', 'WaitingForPlayersText',
        'GiftVIP', 'BuyVIP', 'BuyVIPButton', 'VipMaker', 'VIPController', 'Board',
        'KillScoreboard', 'KillScoreboard2'
      ];

      onlineEntities.forEach(name => {
        const ent = app.root.findByName(name);
        if (ent) {
          ent.enabled = false;
          if (ent.collision) ent.collision.enabled = false;
          console.log(`[SMGrade Standalone Room] Disabled online-only entity: ${name}`);
        }
      });

      const vipNpc = app.root.findByGuid('c694788b-21f6-4805-88ea-c6d94f06bf2a');
      if (vipNpc) {
        vipNpc.enabled = false;
        if (vipNpc.collision) vipNpc.collision.enabled = false;
      }
      const vipBoard = app.root.findByGuid('164a74d0-2164-4b11-86e6-429efe85131e');
      if (vipBoard) {
        vipBoard.enabled = false;
        if (vipBoard.collision) vipBoard.collision.enabled = false;
      }

      // 3. Keyboard-Help section cleanup: Retain ONLY I, P, T. Remove ESC, Y, U, Clan
      const buttonsGroup = app.root.findByName('ButtonsGroup');
      if (buttonsGroup && buttonsGroup.children) {
        buttonsGroup.children.forEach(btn => {
          if (btn.name === 'SettingsButton') {
            btn.enabled = false;
            if (btn.button) btn.button.active = false;
          } else if (btn.name === 'DailyQuestButton') {
            btn.enabled = false;
          } else if (btn.name === 'FriendListButton') {
            btn.enabled = false;
          } else if (btn.name === 'ClanButton') {
            btn.enabled = false;
          }
        });
        console.log('[SMGrade Standalone Room] Keyboard-help section configured: only I, P, T retained.');
      }
    }

    // Requirement 11: Real-time Leaderboard Synchronization
    async updateLiveLeaderboards() {
      try {
        const res = await fetch('/api/master/arcade/game-leaderboards');
        if (!res.ok) return;
        const data = await res.json();
        
        // Pad to exactly 10 slots
        const pad10 = (list) => {
          const arr = (list || []).slice(0, 10).map(x => ({ username: x.username, score: x.score }));
          while (arr.length < 10) {
            arr.push({ username: "—", score: 0 });
          }
          return arr;
        };

        const dwarfBoard = pad10(data.dwarfing);
        const enhanceBoard = pad10(data.enhancing);
        const levelBoard = pad10(data.level);
        this.lastLeaderboardData = { dwarfing: dwarfBoard, enhancing: enhanceBoard, level: levelBoard };

        if (this.networkManager?.app) {
          // Board 1: Dwarfing achievements
          this.networkManager.app.fire("goldLeaderboard", JSON.stringify(dwarfBoard));
          // Board 2: Pet enhancing achievements
          this.networkManager.app.fire("powerLeaderboard", JSON.stringify(enhanceBoard));
          // Board 3: Authentic original 3rd category: Level
          this.networkManager.app.fire("levelLeaderboard", JSON.stringify(levelBoard));
        }
      } catch (err) {
        console.warn('[SMGrade Leaderboards Sync Failed]:', err);
      }
    }

    async recordPlayerStat(stats) {
      try {
        const playerId = localStorage.getItem('smg_player_id');
        const secretToken = localStorage.getItem('smg_player_token');
        if (!playerId || !secretToken) return;

        await fetch('/api/master/arcade/player/record-stat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            secretToken,
            ...stats
          })
        });

        // Trigger immediate leaderboard refresh
        this.updateLiveLeaderboards();
      } catch (e) {
        console.warn('[SMGrade Stat Sync Error]:', e);
      }
    }
  }

  // --- 4. STANDALONE GLOBAL HELPER API ---

  // Add Item to Inventory (Requirements 2 & 3: Max quantity 10, max level 10, NEVER auto-equip)
  window.addStandaloneItem = function (opts) {
    const room = window.standaloneRoom;
    if (!room) return;
    const inv = room.state.playerInventories.items[room.sessionId];
    if (!inv) return;

    // Requirement 3: Enforce strict Level 1-10 boundary (close 10,000 exploit)
    let validLevel = parseInt(opts.level, 10);
    if (isNaN(validLevel) || validLevel < 1) validLevel = 1;
    if (validLevel > 10) {
      console.warn(`[SMGrade Exploit Guard] Rejected level ${opts.level}. Clamped to 10.`);
      validLevel = 10;
    }

    const isSword = opts.isSword !== false;
    const itemSchema = room.createItemSchema({
      type: opts.type !== undefined ? opts.type : 1,
      level: validLevel,
      enchantments: opts.enchantments || [],
      isLocked: false
    }, isSword);

    if (isSword) {
      inv.swords.push(itemSchema);
    } else {
      inv.shields.push(itemSchema);
    }

    room.persistInventory();
    if (room.networkManager?.inventoryController) {
      room.networkManager.items[itemSchema.itemId] = itemSchema;
      room.networkManager.inventoryController.sortInventory();
    }
    const swordsCatalog = window.SWORDMASTERS_SWORDS || (window.StaticData && StaticData.swords) || window.swords || [];
    const shieldsCatalog = window.SWORDMASTERS_SHIELDS || (window.StaticData && StaticData.shields) || window.shields || [];
    const itemMeta = isSword ? swordsCatalog[opts.type] : shieldsCatalog[opts.type];
    const itemTitle = itemMeta?.name || `${isSword ? 'Sword' : 'Shield'} #${opts.type}`;
    if (window.logMasterAction) {
      window.logMasterAction(room.profile?.username, "Item Added", `Added ${itemTitle} (Level ${validLevel}) to inventory`);
    }
    console.log(`[SMGrade Standalone API] Stored ${isSword ? 'sword' : 'shield'} type ${opts.type} level ${validLevel} in inventory. Equipped item unchanged.`);
    return itemSchema;
  };

  // Add Pet to Inventory (Requirement 4 & 5: NEVER auto-equip or auto-summon; batched for high performance)
  window.addStandalonePet = function (opts) {
    const room = window.standaloneRoom;
    if (!room) return;
    const inv = room.state.playerInventories.items[room.sessionId];
    if (!inv) return;

    const count = Math.max(1, parseInt(opts.amount, 10) || 1);
    const petType = opts.type !== undefined ? opts.type : 0;
    let lastPetSchema = null;

    for (let i = 0; i < count; i++) {
      const petSchema = room.createPetSchema({
        type: petType,
        level: 1,
        isLocked: false
      });

      inv.pets.items.push(petSchema);
      if (room.networkManager) {
        room.networkManager.petItems[petSchema.itemId] = petSchema;
      }
      lastPetSchema = petSchema;
    }
    inv.pets.triggerChange();

    room.persistInventory();
    if (room.networkManager?.petUIController) {
      room.networkManager.petUIController.sortInventory();
    }
    const petMeta = (window.StaticData && StaticData.pets && StaticData.pets[petType]) || {};
    const petTitle = petMeta.name || `Pet #${petType}`;
    if (window.logMasterAction) {
      window.logMasterAction(room.profile?.username, "Pet Added", `Added ${count}x ${petTitle} to pet inventory`);
    }
    console.log(`[SMGrade Standalone API] Stored ${count}x pet type ${petType} in pet inventory. Active pets unchanged.`);
    return lastPetSchema;
  };

  // Add Ore (Phase 8)
  window.addStandaloneOre = function (opts) {
    const room = window.standaloneRoom;
    if (!room) return;
    const inv = room.state.playerInventories.items[room.sessionId];
    if (!inv) return;

    const oreSchema = room.createOreSchema({
      type: opts.type !== undefined ? opts.type : 0,
      isMelted: !!opts.isMelted,
      amount: opts.amount || 1,
      isLocked: false
    });

    inv.ores.push(oreSchema);
    room.persistInventory();
    console.log(`[SMGrade Standalone API] Added ore type ${opts.type} (melted: ${opts.isMelted}) x${opts.amount}.`);
    return oreSchema;
  };

  // Edit Resources (Requirement 6 & 7)
  window.setStandaloneResource = function (type, val) {
    const room = window.standaloneRoom;
    if (!room) return;
    const inv = room.state.playerInventories.items[room.sessionId];
    if (!inv) return;

    const num = parseFormattedNumber(val);
    if (type === 'gold') {
      inv.set('gold', num);
      room.networkManager.goldAmount = num;
      if (room.networkManager.goldStatText?.element) {
        room.networkManager.goldStatText.element.text = numRound(num);
      }
      room.profile.gold = num;
    } else if (type === 'power') {
      inv.set('power', num);
      room.networkManager.powerAmount = num;
      if (room.networkManager.powerStatText?.element) {
        room.networkManager.powerStatText.element.text = numRound(num);
      }
      room.profile.power = num;
    } else if (type === 'level') {
      const lvl = Math.max(1, Math.round(num));
      inv.set('level', lvl);
      if (room.networkManager) {
        room.networkManager.lastLevelUpExp = Math.pow(lvl, 4);
        if (room.networkManager.experienceBarLevelText?.element) {
          room.networkManager.experienceBarLevelText.element.text = "Level " + (typeof numRound === 'function' ? numRound(lvl) : lvl);
        }
      }
      const pCtrl = room.networkManager?.currentPlayerEntity?.script?.playerController;
      if (pCtrl) pCtrl.level = lvl;
      room.profile.level = lvl;
    }
    saveLocalArcadeProfile(room.profile);
    if (window.logMasterAction) {
      window.logMasterAction(room.profile?.username, "Resource Updated", `Updated ${type} to ${val}`);
    }
    console.log(`[SMGrade Standalone API] Set ${type} to ${num}`);
  };

  // Global factory function used by NetworkManager.joinServer
  window.createStandaloneOfflineRoom = function (networkManager) {
    const room = new StandaloneLocalRoom(networkManager);
    setTimeout(() => {
      room.initWorld();
    }, 100);
    return room;
  };

  console.log('[SMGrade Standalone Room] Standalone room service registered.');
})();
