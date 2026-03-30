(function () {
    "use strict";

    function CADUCUS() {
        return 'loadstring(game:HttpGet("https://rawscripts.net/raw/Universal-Script-FE-caducus-check-description-73933"))()';
    }

    function SERVER_ADMIN() {
        return 'loadstring(game:HttpGet("https://rawscripts.net/raw/Universal-Script-Server-Admin-R6-47020"))()';
    }

    function GONER() {
        return 'script=game:GetObjects("rbxassetid://4513235536")[1].Goner.ServerScript';
    }

    function WAVE_UNIVERSAL() {
        return 'loadstring(game:HttpGet("https://gist.githubusercontent.com/wave92522-commits/783a95d86c0d22e0fd4c74a9b1003c9e/raw/main.lua"))()';
    }

    // =========================
    // Firebase OAuth + Firestore
    // =========================
    // Firebase config (подключён через Firebase SDK в `index.html`)
    var firebaseConfig = {
        apiKey: "AIzaSyC-01z7uBgrSABM0ibDeFfGQQ1jlnvisrY",
        authDomain: "wave-ss.firebaseapp.com",
        projectId: "wave-ss",
        storageBucket: "wave-ss.firebasestorage.app",
        messagingSenderId: "1046189423349",
        appId: "1:1046189423349:web:234d50e4902083be5de3bc",
        measurementId: "G-YRTELGLSBV"
    };

    // Админ-проверка (пока только заглушка/проверка локально).
    // Дальше ты сам решишь, как включать админ-панель.
    var ADMIN_ROBLOX_USERNAME = "Araen684991";
    var ADMIN_PASSWORD = "k484eo93";

    var authGoogleBtn = document.getElementById("auth-google-btn");
    var authGithubBtn = document.getElementById("auth-github-btn");
    var authStatus = document.getElementById("auth-status");
    var rbxUsernameInput = document.getElementById("rbx-username-input");
    var adminPassInput = document.getElementById("rbx-admin-pass-input");
    var playersList = document.getElementById("players-list");

    var firebaseReady = typeof window !== "undefined" && typeof window.firebase !== "undefined";
    var fbAuth = null;
    var fbDb = null;
    var playersUnsub = null;
    var currentSignedInUser = null;

    function normalizeRobloxUsername(value) {
        if (typeof value !== "string") {
            return "";
        }
        return value.replace(/^@/, "").trim().replace(/\s+/g, "");
    }

    async function lookupRobloxUser(username) {
        // Roblox API: https://users.roblox.com/
        var res = await fetch("https://users.roblox.com/v1/usernames/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [username] })
        });
        if (!res.ok) {
            throw new Error("Roblox lookup failed: HTTP " + res.status);
        }
        var data = await res.json();
        if (!data || !data.data || !data.data[0] || !data.data[0].id) {
            throw new Error("Roblox user not found");
        }
        return {
            robloxUserId: data.data[0].id,
            robloxUsername: data.data[0].name
        };
    }

    async function ensureUserRecord(user) {
        if (!fbDb || !user) {
            return { isAdmin: false, isAdminCandidate: false, rbxUsername: "" };
        }
        var raw = rbxUsernameInput ? String(rbxUsernameInput.value || "") : "";
        raw = raw.trim();
        // Твое требование: ник задаётся как @username
        if (!raw.startsWith("@")) {
            throw new Error("Enter Roblox username with @ (example: @Araen684991).");
        }

        var rbxUsername = normalizeRobloxUsername(raw);
        if (!rbxUsername) {
            throw new Error("Enter Roblox username.");
        }

        // Админ проверяем локально по полю ввода (чтобы логин не ломался из-за роблокс-API).
        var isAdminCandidate =
            normalizeRobloxUsername(ADMIN_ROBLOX_USERNAME).toLowerCase() === rbxUsername.toLowerCase();
        var adminPassword = adminPassInput ? String(adminPassInput.value || "") : "";
        var isAdmin = isAdminCandidate && adminPassword === ADMIN_PASSWORD;

        // Roblox lookup может не пройти (rate limit / CORS / API issues) — логин и админ-панель не должны падать.
        var roblox = { robloxUsername: rbxUsername, robloxUserId: null };
        try {
            var lookedUp = await lookupRobloxUser(rbxUsername);
            roblox.robloxUsername = lookedUp.robloxUsername || roblox.robloxUsername;
            roblox.robloxUserId = lookedUp.robloxUserId || null;
        } catch (e) {}

        var docRef = fbDb.collection("registeredUsers").doc(String(user.uid));
        var now = window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue
            ? window.firebase.firestore.FieldValue.serverTimestamp()
            : Date.now();

        await docRef.set(
            {
                uid: String(user.uid),
                email: user.email || null,
                displayName: user.displayName || null,
                authProviders: (user.providerData || []).map(function (p) {
                    return p.providerId;
                }),
                robloxUsername: roblox.robloxUsername,
                robloxUserId: roblox.robloxUserId,
                // Поля для админ-логики
                adminCandidate: isAdminCandidate,
                admin: isAdmin,
                createdAt: now,
                updatedAt: now,
                lastLoginAt: now
            },
            { merge: true }
        );

        return { isAdmin: isAdmin, isAdminCandidate: isAdminCandidate, rbxUsername: rbxUsername };
    }

    function renderPlayers(snapshotDocs) {
        if (!playersList) {
            return;
        }
        playersList.innerHTML = "";
        if (!snapshotDocs || !snapshotDocs.length) {
            var emptyLi = document.createElement("li");
            emptyLi.className = "player-item";
            emptyLi.setAttribute("role", "listitem");
            emptyLi.innerHTML =
                '<span class="player-avatar"></span><span class="player-name">No registered users.</span>';
            playersList.appendChild(emptyLi);
            return;
        }

        snapshotDocs.forEach(function (doc) {
            var d = doc;
            var li = document.createElement("li");
            li.className = "player-item";
            li.setAttribute("role", "listitem");
            var name = d.robloxUsername || d.roblox_username || "Unknown";
            var uid = d.robloxUserId ? String(d.robloxUserId) : "";
            li.innerHTML =
                '<span class="player-avatar"></span>' +
                '<span class="player-name">' +
                String(name) +
                "</span>" +
                '<span class="player-tag">' +
                (uid ? ("ID: " + uid) : "") +
                "</span>";
            playersList.appendChild(li);
        });
    }

    function subscribePlayers() {
        if (!fbDb) {
            return;
        }
        if (playersUnsub) {
            try {
                playersUnsub();
            } catch (e) {}
        }
        playersUnsub = fbDb.collection("registeredUsers").orderBy("createdAt", "desc").limit(100).onSnapshot(
            function (snap) {
                var docs = snap && snap.docs ? snap.docs.map(function (x) { return x.data(); }) : [];
                renderPlayers(docs);
            },
            function (err) {
                if (authStatus) {
                    authStatus.textContent = "Firestore error: " + String(err && err.message ? err.message : err);
                }
            }
        );
    }

    function setAuthStatus(text) {
        if (authStatus) {
            authStatus.textContent = text;
        }
    }

    function setAdminAccess(isAdmin) {
        var enabled = !!isAdmin;

        if (tabAdmin) {
            tabAdmin.disabled = !enabled;
            tabAdmin.setAttribute("aria-disabled", enabled ? "false" : "true");
            tabAdmin.classList.toggle("ss-nav-item--disabled", !enabled);
        }

        if (adminStatus) {
            adminStatus.textContent = enabled ? "Admin is enabled." : "Admin access denied.";
        }

        if (adminActions) {
            adminActions.hidden = !enabled;
        }

        // If user is viewing the admin page but loses admin access, kick them out.
        if (!enabled && panelAdmin && panelAdmin.hidden === false) {
            try {
                switchTab("home");
            } catch (e) {}
        }
    }

    async function signInWithProvider(provider) {
        if (!fbAuth) {
            return;
        }
        setAuthStatus("Signing in...");
        try {
            var result = await fbAuth.signInWithPopup(provider);
            currentSignedInUser = result && result.user ? result.user : null;
            setAuthStatus("OAuth success. Saving profile...");
            var ensured = await ensureUserRecord(currentSignedInUser);
            setAdminAccess(ensured && ensured.isAdmin);
            setAuthStatus("Saved. Loading Players...");
            subscribePlayers();
        } catch (e) {
            setAuthStatus("Auth error: " + String(e && e.message ? e.message : e));
        }
    }

    function initFirebaseAuthStub() {
        if (!firebaseReady) {
            return;
        }
        try {
            if (!window.firebase.apps || window.firebase.apps.length === 0) {
                window.firebase.initializeApp(firebaseConfig);
            }
            fbAuth = window.firebase.auth();
            fbDb = window.firebase.firestore();
        } catch (e) {
            // Firebase не настроен или неверные ключи
            setAuthStatus("Firebase init error: " + String(e && e.message ? e.message : e));
            return;
        }

        if (authGoogleBtn) {
            authGoogleBtn.addEventListener("click", function () {
                var provider = new window.firebase.auth.GoogleAuthProvider();
                signInWithProvider(provider);
            });
        }
        if (authGithubBtn) {
            authGithubBtn.addEventListener("click", function () {
                var provider = new window.firebase.auth.GithubAuthProvider();
                signInWithProvider(provider);
            });
        }

        if (fbAuth) {
            fbAuth.onAuthStateChanged(async function (user) {
                currentSignedInUser = user || null;
                if (!user) {
                    setAuthStatus("Not logged in.");
                    setAdminAccess(false);
                    if (playersUnsub) {
                        try {
                            playersUnsub();
                        } catch (e) {}
                        playersUnsub = null;
                    }
                    if (playersList) {
                        playersList.innerHTML = "";
                        var li = document.createElement("li");
                        li.className = "player-item";
                        li.setAttribute("role", "listitem");
                        li.innerHTML =
                            '<span class="player-avatar"></span><span class="player-name">Login to load players.</span>';
                        playersList.appendChild(li);
                    }
                    return;
                }

                setAuthStatus("Logged in. Saving profile...");
                try {
                    var ensured = await ensureUserRecord(user);
                    setAdminAccess(ensured && ensured.isAdmin);
                } catch (e) {
                    setAuthStatus("Save error: " + String(e && e.message ? e.message : e));
                }
                setAuthStatus("Loading Players...");
                subscribePlayers();
            });
        }
    }

    var ENDER_STORAGE_KEY = "wave_ss_ender_lua";
    var enderSourceText = "";

    function ENDER() {
        return enderSourceText;
    }

    var ISSUED_KEYS_LS = "wave_ss_issued_keys";
    var SESSION_LS = "wave_ss_session";
    var KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var WAVE_HOURS = 5;
    var PREMIUM_HOURS = 10;

    var sessionTimerId = null;
    var activeSessionUntil = 0;
    var activeKeyKind = "wave";

    var vaultMode = null;
    var simonLength = 4;
    var simonSequence = [];
    var simonUserIndex = 0;
    var vaultSimonPlaying = false;
    var vaultQuizAnswer = 0;

    var WAVE_TOTAL_STEPS = 10;
    var WAVE_STAGE_SUBTITLE = {
        1: "Инициализация волны",
        2: "Временной модуль",
        3: "Память последовательности",
        4: "Числовой шлюз",
        5: "Нейро-эхо",
        6: "Кодовое слово",
        7: "Расширенная синхронизация",
        8: "Финальный шлюз",
        9: "Пульс памяти",
        10: "Финальный токен"
    };
    var waveVaultStep = 0;
    var vaultQuizIsNumeric = true;
    var vaultQuizAnswerStr = "";
    var waveRandomMult = { a4: 0, b4: 0, a8: 0, b8: 0 };

    var keyOverlay = document.getElementById("key-overlay");
    var keyForm = document.getElementById("key-form");
    var keyInput = document.getElementById("key-input");
    var keyError = document.getElementById("key-error");
    var toggleVisibility = document.getElementById("toggle-visibility");
    var openKeyAgain = document.getElementById("open-key-again");
    var lockStatus = document.getElementById("lock-status");
    var goUnlockButtons = document.querySelectorAll(".go-unlock");

    var tabHome = document.getElementById("tab-home");
    var tabVisuals = document.getElementById("tab-visuals");
    var tabPlayers = document.getElementById("tab-players");
    var tabScripts = document.getElementById("tab-scripts");
    var tabAdmin = document.getElementById("tab-admin");

    var panelHome = document.getElementById("panel-home");
    var panelVisuals = document.getElementById("panel-visuals");
    var panelPlayers = document.getElementById("panel-players");
    var panelGameHub = document.getElementById("panel-gamehub");
    var panelScripts = document.getElementById("panel-scripts");
    var panelAdmin = document.getElementById("panel-admin");

    var caducusCode = document.getElementById("caducus-code");
    var copyCaducus = document.getElementById("copy-caducus");
    var serverAdminCode = document.getElementById("server-admin-code");
    var copyServerAdmin = document.getElementById("copy-server-admin");
    var gonerCode = document.getElementById("goner-code");
    var copyGoner = document.getElementById("copy-goner");

    var grabKnifeV3Code = document.getElementById("grab-knife-v3-code");
    var copyGrabKnifeV3 = document.getElementById("copy-grab-knife-v3");
    var grabKnifeV3Loaded = false;

    var waveUniversalCode = document.getElementById("wave-universal-code");
    var copyWaveUniversal = document.getElementById("copy-wave-universal");

    var enderCode = document.getElementById("ender-code");
    var enderFile = document.getElementById("ender-file");
    var enderSaveLs = document.getElementById("ender-save-ls");
    var copyEnder = document.getElementById("copy-ender");
    var scriptsSearch = document.getElementById("scripts-search");

    var adminStatus = document.getElementById("admin-status");
    var adminActions = document.getElementById("admin-actions");
    var adminDenied = document.getElementById("admin-denied");
    var adminReloadPlayers = document.getElementById("admin-reload-players");

    var sliderR = document.getElementById("slider-r");
    var sliderG = document.getElementById("slider-g");
    var sliderB = document.getElementById("slider-b");
    var sliderIntensity = document.getElementById("slider-intensity");
    var valR = document.getElementById("val-r");
    var valG = document.getElementById("val-g");
    var valB = document.getElementById("val-b");
    var valIntensity = document.getElementById("val-intensity");
    var resetNeon = document.getElementById("reset-neon");
    var neonHex = document.getElementById("neon-hex");
    var root = document.documentElement;

    var vaultToggle = document.getElementById("vault-toggle");
    var vaultBody = document.getElementById("vault-body");
    var phasePick = document.getElementById("vault-phase-pick");
    var phaseSimon = document.getElementById("vault-phase-simon");
    var phaseQuiz = document.getElementById("vault-phase-quiz");
    var phaseDone = document.getElementById("vault-phase-done");
    var pickWave = document.getElementById("pick-wave");
    var pickPremium = document.getElementById("pick-premium");
    var simonPads = document.getElementById("simon-pads");
    var vaultSimonTitle = document.getElementById("vault-simon-title");
    var simonStatus = document.getElementById("vault-simon-status");
    var vaultQuizTitle = document.getElementById("vault-quiz-title");
    var vaultQuizQuestion = document.getElementById("vault-quiz-question");
    var vaultQuizInput = document.getElementById("vault-quiz-input");
    var vaultQuizError = document.getElementById("vault-quiz-error");
    var vaultQuizSubmit = document.getElementById("vault-quiz-submit");
    var vaultDoneType = document.getElementById("vault-done-type");
    var vaultResultKey = document.getElementById("vault-result-key");
    var vaultResultExpires = document.getElementById("vault-result-expires");
    var vaultCopyKey = document.getElementById("vault-copy-key");
    var vaultRestart = document.getElementById("vault-restart");
    var vaultQuizLabel = document.getElementById("vault-quiz-label");
    var vaultWaveTrack = document.getElementById("vault-wave-track");
    var vaultWaveProgress = document.getElementById("vault-wave-progress");
    var vaultWaveSub = document.getElementById("vault-wave-sub");
    var vaultWaveBarWrap = document.getElementById("vault-wave-bar-wrap");
    var vaultWaveProgressBar = document.getElementById("vault-wave-progress-bar");

    var layoutLocked = document.getElementById("layout-locked");
    var layoutDash = document.getElementById("layout-dash");
    var dashLockStatus = document.getElementById("dash-lock-status");
    var dashUserSuffix = document.getElementById("dash-user-suffix");

    function setLayoutMode(unlocked) {
        if (layoutLocked) {
            layoutLocked.hidden = !!unlocked;
        }
        if (layoutDash) {
            layoutDash.hidden = !unlocked;
        }
    }

    function randomUserSuffix() {
        return String(Math.floor(10000 + Math.random() * 90000));
    }

    function scriptSlug(title) {
        if (typeof title !== "string") {
            return "";
        }
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function buildScriptGrid() {
        var grid = document.getElementById("ss-script-grid");
        if (!grid) {
            return;
        }
        grid.innerHTML = "";

        function appendCard(name, title, desc, imageClass) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "ss-script-card";
            btn.setAttribute("data-script-name", name);
            btn.setAttribute("data-script-title", title);
            btn.setAttribute("data-script-desc", desc || "");
            btn.setAttribute("aria-expanded", "false");
            var img = document.createElement("div");
            img.className = "ss-card-image " + (imageClass || "ss-card-image--demo");
            var body = document.createElement("div");
            body.className = "ss-card-body";
            var h = document.createElement("h3");
            h.className = "ss-card-title";
            h.textContent = title;
            var p = document.createElement("p");
            p.className = "ss-card-desc";
            p.textContent = desc || "";
            body.appendChild(h);
            body.appendChild(p);
            btn.appendChild(img);
            btn.appendChild(body);
            grid.appendChild(btn);
        }

        appendCard("caducus", "Caducus", "Universal FE script.", "ss-card-image--caducus");
        appendCard(
            "server-admin",
            "Server Admin",
            "R6 admin script.",
            "ss-card-image--server-admin"
        );
        appendCard("goner", "Goner", "ServerScript from asset.", "ss-card-image--goner");
        appendCard(
            "grab-knife-v3",
            "Grab Knife V3",
            "Roblox grab knife (V3) — click to view & copy.",
            "ss-card-image--grab-knife"
        );
    }

    function normalizeKey(value) {
        if (typeof value !== "string") {
            return "";
        }
        return value
            .trim()
            .replace(/\s+/g, "")
            .replace(/\u2013/g, "-")
            .toUpperCase();
    }

    function normalizeQuizText(value) {
        if (typeof value !== "string") {
            return "";
        }
        return value.trim().replace(/\s+/g, "").toUpperCase();
    }

    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function formatTimeLeft(ms) {
        var s = Math.floor(ms / 1000);
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = s % 60;
        return pad2(h) + ":" + pad2(m) + ":" + pad2(sec);
    }

    function pruneAndLoadIssued() {
        var raw = localStorage.getItem(ISSUED_KEYS_LS);
        var list = [];
        if (raw) {
            try {
                list = JSON.parse(raw);
                if (!Array.isArray(list)) {
                    list = [];
                }
            } catch (err) {
                list = [];
            }
        }
        var now = Date.now();
        list = list.filter(function (item) {
            return (
                item &&
                item.type === "wave" &&
                typeof item.expiresAt === "number" &&
                item.expiresAt > now &&
                typeof item.key === "string"
            );
        });
        localStorage.setItem(ISSUED_KEYS_LS, JSON.stringify(list));
        return list;
    }

    function registerIssuedKey(keyStr, kind, expiresAt) {
        var list = pruneAndLoadIssued();
        list.push({
            key: normalizeKey(keyStr),
            type: kind,
            issuedAt: Date.now(),
            expiresAt: expiresAt
        });
        if (list.length > 24) {
            list = list.slice(-24);
        }
        localStorage.setItem(ISSUED_KEYS_LS, JSON.stringify(list));
    }

    function findIssuedKey(entered) {
        var normalized = normalizeKey(entered);
        var list = pruneAndLoadIssued();
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i].key === normalized) {
                return list[i];
            }
        }
        return null;
    }

    function randomKeyChunk(length) {
        var out = "";
        var buf = new Uint8Array(length);
        crypto.getRandomValues(buf);
        var i;
        for (i = 0; i < length; i++) {
            out += KEY_ALPHABET.charAt(buf[i] % KEY_ALPHABET.length);
        }
        return out;
    }

    function makeWaveKeyString() {
        return "WAVE-" + randomKeyChunk(4) + "-" + randomKeyChunk(4) + "-" + randomKeyChunk(4);
    }

    function makePremiumKeyString() {
        return "PRM-" + randomKeyChunk(4) + "-" + randomKeyChunk(4) + "-" + randomKeyChunk(4) + "-" + randomKeyChunk(4);
    }

    function showKeyError(message) {
        keyError.textContent = message;
        keyError.hidden = false;
        keyInput.setAttribute("aria-invalid", "true");
    }

    function clearKeyError() {
        keyError.textContent = "";
        keyError.hidden = true;
        keyInput.removeAttribute("aria-invalid");
    }

    function setOverlayVisible(visible) {
        if (visible) {
            keyOverlay.classList.remove("is-hidden");
            keyOverlay.setAttribute("aria-hidden", "false");
            window.setTimeout(function () {
                keyInput.focus();
            }, 320);
        } else {
            keyOverlay.classList.add("is-hidden");
            keyOverlay.setAttribute("aria-hidden", "true");
            clearKeyError();
        }
    }

    function lockOutSession() {
        if (sessionTimerId !== null) {
            window.clearInterval(sessionTimerId);
            sessionTimerId = null;
        }
        setLayoutMode(false);
        document.body.classList.remove("wave-unlocked");
        activeSessionUntil = 0;
        try {
            sessionStorage.removeItem(SESSION_LS);
        } catch (e) {
        }
        tabVisuals.disabled = true;
        tabPlayers.disabled = true;
        tabScripts.disabled = true;
        tabVisuals.setAttribute("aria-disabled", "true");
        tabPlayers.setAttribute("aria-disabled", "true");
        tabScripts.setAttribute("aria-disabled", "true");
        tabVisuals.classList.add("nav-tab-locked");
        tabPlayers.classList.add("nav-tab-locked");
        tabScripts.classList.add("nav-tab-locked");
        tabVisuals.setAttribute("title", "Требуется ключ");
        tabPlayers.setAttribute("title", "Требуется ключ");
        tabScripts.setAttribute("title", "Требуется ключ");
        lockStatus.textContent = "Сессия истекла — получите ключ";
        lockStatus.classList.add("lock-status-locked");
        lockStatus.classList.remove("lock-status-unlocked");
        if (dashLockStatus) {
            dashLockStatus.textContent = "—";
        }
        openKeyAgain.textContent = "Ввести ключ";
        setOverlayVisible(true);
        switchTab("home");
    }

    function tickSession() {
        var left = activeSessionUntil - Date.now();
        if (left <= 0) {
            if (sessionTimerId !== null) {
                window.clearInterval(sessionTimerId);
                sessionTimerId = null;
            }
            lockOutSession();
            return;
        }
        var msg = "Wave key · " + formatTimeLeft(left);
        lockStatus.textContent = msg;
        if (dashLockStatus) {
            dashLockStatus.textContent = msg;
        }
    }

    function startSessionTicker() {
        if (sessionTimerId !== null) {
            window.clearInterval(sessionTimerId);
        }
        sessionTimerId = window.setInterval(tickSession, 1000);
        tickSession();
    }

    function applyUnlockState(untilMs, keyKind) {
        setLayoutMode(true);
        document.body.classList.add("wave-unlocked");
        activeSessionUntil = untilMs;
        activeKeyKind = keyKind;
        if (dashUserSuffix) {
            dashUserSuffix.textContent = randomUserSuffix();
        }
        try {
            sessionStorage.setItem(
                SESSION_LS,
                JSON.stringify({
                    until: untilMs,
                    keyKind: keyKind
                })
            );
        } catch (e) {
        }
        tabVisuals.disabled = false;
        tabPlayers.disabled = false;
        tabScripts.disabled = false;
        tabVisuals.removeAttribute("aria-disabled");
        tabPlayers.removeAttribute("aria-disabled");
        tabScripts.removeAttribute("aria-disabled");
        tabVisuals.classList.remove("nav-tab-locked");
        tabPlayers.classList.remove("nav-tab-locked");
        tabScripts.classList.remove("nav-tab-locked");
        tabVisuals.removeAttribute("title");
        tabPlayers.removeAttribute("title");
        tabScripts.removeAttribute("title");
        lockStatus.classList.remove("lock-status-locked");
        lockStatus.classList.add("lock-status-unlocked");
        openKeyAgain.textContent = "Повторный ввод ключа";
        startSessionTicker();
    }

    function tryUnlockFromInput() {
        var entered = normalizeKey(keyInput.value);
        clearKeyError();
        if (entered === "") {
            showKeyError("Введите ключ доступа.");
            return false;
        }
        var record = findIssuedKey(entered);
        if (!record) {
            showKeyError("Ключ не найден или срок истёк. Пройдите протокол выдачи ниже.");
            keyInput.select();
            return false;
        }
        if (Date.now() >= record.expiresAt) {
            showKeyError("Срок этого ключа уже истёк. Сгенерируйте новый.");
            pruneAndLoadIssued();
            keyInput.select();
            return false;
        }
        applyUnlockState(record.expiresAt, record.type);
        setOverlayVisible(false);
        return true;
    }

    function restoreSessionUnlock() {
        try {
            var raw = sessionStorage.getItem(SESSION_LS);
            if (!raw) {
                return false;
            }
            var data = JSON.parse(raw);
            if (!data || typeof data.until !== "number" || typeof data.keyKind !== "string") {
                sessionStorage.removeItem(SESSION_LS);
                return false;
            }
            if (data.until <= Date.now()) {
                sessionStorage.removeItem(SESSION_LS);
                return false;
            }
            applyUnlockState(data.until, data.keyKind);
            setOverlayVisible(false);
            return true;
        } catch (e) {
            try {
                sessionStorage.removeItem(SESSION_LS);
            } catch (e2) {
            }
        }
        return false;
    }

    function syncSsSidebarNav(tabId) {
        document.querySelectorAll(".ss-nav-item[data-tab]").forEach(function (btn) {
            var on = btn.getAttribute("data-tab") === tabId;
            btn.classList.toggle("is-active", on);
            if (on) {
                btn.setAttribute("aria-current", "page");
            } else {
                btn.removeAttribute("aria-current");
            }
        });
    }

    function switchTab(tabId) {
        var tabs = [
            { id: "home", button: tabHome, panel: panelHome },
            { id: "visuals", button: tabVisuals, panel: panelVisuals },
            { id: "players", button: tabPlayers, panel: panelPlayers },
            { id: "gamehub", button: null, panel: panelGameHub },
            { id: "admin", button: null, panel: panelAdmin },
            { id: "scripts", button: tabScripts, panel: panelScripts }
        ];
        var i;
        for (i = 0; i < tabs.length; i++) {
            if (!tabs[i].panel) {
                continue;
            }
            if (tabs[i].id === tabId) {
                if (tabs[i].button) {
                    tabs[i].button.classList.add("is-active");
                }
                tabs[i].panel.hidden = false;
            } else {
                if (tabs[i].button) {
                    tabs[i].button.classList.remove("is-active");
                }
                tabs[i].panel.hidden = true;
            }
        }
        syncSsSidebarNav(tabId);
    }

    function setSsLibraryTab(which) {
        var pub = document.getElementById("ss-panel-public");
        var priv = document.getElementById("ss-panel-private");
        var sel = document.getElementById("ss-tabs-select");
        if (!pub || !priv) {
            return;
        }
        var isPublic = which === "public";
        pub.hidden = !isPublic;
        priv.hidden = isPublic;
        pub.classList.toggle("is-hidden", !isPublic);
        priv.classList.toggle("is-hidden", isPublic);
        document.querySelectorAll(".ss-tab[data-ss-tab]").forEach(function (btn) {
            var on = btn.getAttribute("data-ss-tab") === which;
            btn.classList.toggle("is-active", on);
            if (on) {
                btn.setAttribute("aria-current", "true");
            } else {
                btn.removeAttribute("aria-current");
            }
        });
        if (sel) {
            sel.value = which;
        }
    }

    function closeSsSidebar() {
        var sb = document.getElementById("ss-sidebar");
        var tg = document.getElementById("ss-sidebar-toggle");
        if (sb) {
            sb.classList.remove("is-open");
        }
        if (tg) {
            tg.setAttribute("aria-expanded", "false");
        }
    }

    function selectScriptCard(name) {
        document.querySelectorAll(".ss-script-card").forEach(function (c) {
            var on = c.getAttribute("data-script-name") === name;
            c.classList.toggle("is-selected", on);
            c.setAttribute("aria-expanded", on ? "true" : "false");
        });
        var dc = document.getElementById("ss-detail-caducus");
        var ds = document.getElementById("ss-detail-server-admin");
        var dg = document.getElementById("ss-detail-goner");
        var dk = document.getElementById("ss-detail-grab-knife-v3");
        if (!dc || !ds || !dg || !dk) {
            return;
        }
        function hideBlock(el) {
            el.hidden = true;
            el.classList.add("is-hidden");
        }
        function showBlock(el) {
            el.hidden = false;
            el.classList.remove("is-hidden");
        }
        hideBlock(dc);
        hideBlock(ds);
        hideBlock(dg);
        hideBlock(dk);
        if (name === "caducus") {
            showBlock(dc);
            return;
        }
        if (name === "server-admin") {
            showBlock(ds);
            return;
        }
        if (name === "goner") {
            showBlock(dg);
            return;
        }
        if (name === "grab-knife-v3") {
            showBlock(dk);
            ensureGrabKnifeV3Loaded();
            return;
        }
        showBlock(dc);
    }

    async function ensureGrabKnifeV3Loaded() {
        if (grabKnifeV3Loaded) {
            return;
        }
        if (!grabKnifeV3Code) {
            return;
        }
        grabKnifeV3Code.textContent = "Loading Grab Knife V3...";
        try {
            var res = await fetch("grab-knife-v3.lua", { cache: "no-store" });
            if (!res.ok) {
                throw new Error("HTTP " + res.status);
            }
            var text = await res.text();
            if (!text || !text.trim()) {
                throw new Error("Empty response");
            }
            grabKnifeV3Code.textContent = text;
            grabKnifeV3Loaded = true;
        } catch (e) {
            grabKnifeV3Code.textContent =
                "Failed to load `grab-knife-v3.lua`. Check that file exists in the repo.";
        }
    }

    function rgbToHex(r, g, b) {
        function toHex(n) {
            var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
            return s.length === 1 ? "0" + s : s;
        }
        return "#" + toHex(r) + toHex(g) + toHex(b);
    }

    function updateNeonFromSliders() {
        var r = Number(sliderR.value);
        var g = Number(sliderG.value);
        var b = Number(sliderB.value);
        var intensityRaw = Number(sliderIntensity.value);
        var intensity = intensityRaw / 100;
        root.style.setProperty("--neon-r", String(r));
        root.style.setProperty("--neon-g", String(g));
        root.style.setProperty("--neon-b", String(b));
        root.style.setProperty("--neon-intensity", String(intensity));
        valR.textContent = String(r);
        valG.textContent = String(g);
        valB.textContent = String(b);
        valIntensity.textContent = String(intensityRaw) + "%";
        neonHex.textContent = rgbToHex(r, g, b).toUpperCase();
    }

    function resetNeonDefaults() {
        sliderR.value = "0";
        sliderG.value = "212";
        sliderB.value = "255";
        sliderIntensity.value = "100";
        updateNeonFromSliders();
    }

    function showVaultPhase(phase) {
        phasePick.hidden = phase !== "pick";
        phaseSimon.hidden = phase !== "simon";
        phaseQuiz.hidden = phase !== "quiz";
        phaseDone.hidden = phase !== "done";
    }

    function setSimonPadsDisabled(disabled) {
        var pads = simonPads.querySelectorAll(".simon-pad");
        var i;
        for (i = 0; i < pads.length; i++) {
            pads[i].disabled = disabled;
        }
    }

    function flashPad(cellIndex, durationMs, onDone) {
        var btn = simonPads.querySelector('[data-simon-idx="' + cellIndex + '"]');
        if (!btn) {
            if (onDone) {
                onDone();
            }
            return;
        }
        btn.classList.add("is-lit");
        window.setTimeout(function () {
            btn.classList.remove("is-lit");
            if (onDone) {
                onDone();
            }
        }, durationMs);
    }

    function playSimonSequence() {
        setSimonPadsDisabled(true);
        vaultSimonPlaying = true;
        simonStatus.textContent = "Наблюдайте за очередностью вспышек…";
        var idx = 0;

        function step() {
            if (idx >= simonSequence.length) {
                vaultSimonPlaying = false;
                setSimonPadsDisabled(false);
                simonStatus.textContent = "Повторите нажатия на ячейки.";
                simonUserIndex = 0;
                return;
            }
            var cell = simonSequence[idx];
            flashPad(cell, 520, function () {
                window.setTimeout(function () {
                    idx++;
                    step();
                }, 160);
            });
        }
        step();
    }

    function startSimonRound() {
        simonSequence = [];
        var i;
        for (i = 0; i < simonLength; i++) {
            simonSequence.push(Math.floor(Math.random() * 3));
        }
        simonUserIndex = 0;
        playSimonSequence();
    }

    function updateWaveVaultUI() {
        if (!vaultWaveTrack || !vaultWaveProgress || !vaultWaveProgressBar) {
            return;
        }
        if (vaultMode === "wave" && waveVaultStep > 0) {
            vaultWaveTrack.hidden = false;
            vaultWaveProgress.textContent = "Этап " + waveVaultStep + " из " + WAVE_TOTAL_STEPS;
            if (vaultWaveSub) {
                vaultWaveSub.textContent = WAVE_STAGE_SUBTITLE[waveVaultStep] || "Wave key";
            }
            vaultWaveProgressBar.style.width = (waveVaultStep / WAVE_TOTAL_STEPS) * 100 + "%";
            if (vaultWaveBarWrap) {
                vaultWaveBarWrap.setAttribute("aria-valuenow", String(waveVaultStep));
            }
        } else {
            vaultWaveTrack.hidden = true;
        }
    }

    function onWaveAdvanceAfterSuccess() {
        waveVaultStep++;
        if (waveVaultStep > WAVE_TOTAL_STEPS) {
            finalizeVaultIssuance();
        } else {
            runWaveStep(waveVaultStep);
        }
    }

    function startWaveProtocol() {
        vaultMode = "wave";
        waveVaultStep = 1;
        waveRandomMult.a4 = 9 + Math.floor(Math.random() * 14);
        waveRandomMult.b4 = 35 + Math.floor(Math.random() * 55);
        waveRandomMult.a8 = 9 + Math.floor(Math.random() * 14);
        waveRandomMult.b8 = 35 + Math.floor(Math.random() * 55);
        updateWaveVaultUI();
        runWaveStep(1);
    }

    function startPremiumProtocol() {
        vaultMode = "premium";
        waveVaultStep = 0;
        updateWaveVaultUI();
        showVaultPhase("simon");
        simonLength = 6;
        vaultSimonTitle.textContent = "Этап 1 — расширенная нейро-синхронизация";
        startSimonRound();
    }

    function runWaveStep(step) {
        updateWaveVaultUI();
        var simonMap = { 1: 3, 3: 4, 5: 5, 7: 6, 9: 7 };
        if (simonMap[step] !== undefined) {
            showVaultPhase("simon");
            simonLength = simonMap[step];
            vaultSimonTitle.textContent = "Этап " + step + " из 10 — память последовательности";
            startSimonRound();
            return;
        }
        openWaveQuizStep(step);
    }

    function openWaveQuizStep(step) {
        showVaultPhase("quiz");
        vaultQuizInput.value = "";
        vaultQuizError.hidden = true;
        vaultQuizIsNumeric = true;
        vaultQuizAnswerStr = "";
        if (step === 2) {
            vaultQuizTitle.textContent = "Этап 2 из 10 — временной модуль";
            vaultQuizQuestion.textContent =
                "Сколько секунд содержится ровно в пяти часах? Введите целое число без пробелов.";
            vaultQuizAnswer = WAVE_HOURS * 3600;
            if (vaultQuizLabel) {
                vaultQuizLabel.textContent = "Ответ (целое число)";
            }
            vaultQuizInput.setAttribute("inputmode", "numeric");
            vaultQuizInput.maxLength = 12;
        } else if (step === 4) {
            vaultQuizTitle.textContent = "Этап 4 из 10 — числовой шлюз";
            vaultQuizAnswer = waveRandomMult.a4 * waveRandomMult.b4;
            vaultQuizQuestion.textContent =
                "Вычислите произведение: " + waveRandomMult.a4 + " × " + waveRandomMult.b4 + " = ?";
            if (vaultQuizLabel) {
                vaultQuizLabel.textContent = "Ответ (целое число)";
            }
            vaultQuizInput.setAttribute("inputmode", "numeric");
            vaultQuizInput.maxLength = 12;
        } else if (step === 6) {
            vaultQuizIsNumeric = false;
            vaultQuizAnswerStr = "WAVE";
            vaultQuizTitle.textContent = "Этап 6 из 10 — кодовое слово";
            vaultQuizQuestion.textContent = "Введите кодовое слово латиницей (как у ключа Wave).";
            if (vaultQuizLabel) {
                vaultQuizLabel.textContent = "Кодовое слово";
            }
            vaultQuizInput.setAttribute("inputmode", "text");
            vaultQuizInput.maxLength = 16;
        } else if (step === 8) {
            vaultQuizTitle.textContent = "Этап 8 из 10 — числовой шлюз";
            vaultQuizAnswer = waveRandomMult.a8 * waveRandomMult.b8;
            vaultQuizQuestion.textContent =
                "Вычислите произведение: " + waveRandomMult.a8 + " × " + waveRandomMult.b8 + " = ?";
            if (vaultQuizLabel) {
                vaultQuizLabel.textContent = "Ответ (целое число)";
            }
            vaultQuizInput.setAttribute("inputmode", "numeric");
            vaultQuizInput.maxLength = 12;
        } else if (step === 10) {
            vaultQuizIsNumeric = false;
            vaultQuizAnswerStr = "3ND37";
            vaultQuizTitle.textContent = "Этап 10 из 10 — финальный токен";
            vaultQuizQuestion.textContent =
                "Введите финальный токен из лора Ender (строка «You get …»).";
            if (vaultQuizLabel) {
                vaultQuizLabel.textContent = "Финальный токен";
            }
            vaultQuizInput.setAttribute("inputmode", "text");
            vaultQuizInput.maxLength = 16;
        }
        vaultQuizSubmit.textContent = step === 10 ? "Проверить и выдать ключ" : "Продолжить";
        window.setTimeout(function () {
            vaultQuizInput.focus();
        }, 200);
    }

    function openPremiumQuiz() {
        showVaultPhase("quiz");
        vaultQuizInput.value = "";
        vaultQuizError.hidden = true;
        vaultQuizIsNumeric = true;
        vaultQuizAnswerStr = "";
        var a = 9 + Math.floor(Math.random() * 14);
        var b = 35 + Math.floor(Math.random() * 55);
        vaultQuizAnswer = a * b;
        vaultQuizTitle.textContent = "Этап 2 — криптографическая ячейка";
        vaultQuizQuestion.textContent = "Вычислите точное произведение: " + a + " × " + b + " = ?";
        if (vaultQuizLabel) {
            vaultQuizLabel.textContent = "Ответ (целое число)";
        }
        vaultQuizInput.setAttribute("inputmode", "numeric");
        vaultQuizInput.maxLength = 12;
        vaultQuizSubmit.textContent = "Проверить и выдать ключ";
        window.setTimeout(function () {
            vaultQuizInput.focus();
        }, 200);
    }

    function onSimonPadClick(cellIndex) {
        if (vaultSimonPlaying) {
            return;
        }
        var expected = simonSequence[simonUserIndex];
        flashPad(cellIndex, 180, function () {});
        if (cellIndex !== expected) {
            simonStatus.textContent = "Ошибка. Генерируется новая последовательность…";
            window.setTimeout(function () {
                startSimonRound();
            }, 900);
            return;
        }
        simonUserIndex++;
        if (simonUserIndex >= simonSequence.length) {
            simonStatus.textContent = "Этап пройден.";
            window.setTimeout(function () {
                if (vaultMode === "wave") {
                    onWaveAdvanceAfterSuccess();
                } else {
                    onWaveAdvanceAfterSuccess();
                }
            }, 480);
        }
    }

    function finalizeVaultIssuance() {
        var keyStr = makeWaveKeyString();
        var expiresAt = Date.now() + WAVE_HOURS * 3600 * 1000;
        registerIssuedKey(keyStr, "wave", expiresAt);
        showVaultPhase("done");
        vaultDoneType.textContent = "Wave key — доступ 5 часов";
        vaultResultKey.textContent = keyStr;
        vaultResultExpires.textContent =
            "Действителен до " +
            new Date(expiresAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) +
            ".";
        vaultQuizError.hidden = true;
        waveVaultStep = 0;
        updateWaveVaultUI();
    }

    function setEnderDisplay(text) {
        enderSourceText = text || "";
        if (enderCode) {
            if (enderSourceText.trim()) {
                enderCode.textContent = enderSourceText;
                enderCode.classList.remove("ss-code--muted");
            } else {
                enderCode.textContent =
                    "Нет кода: положите полный скрипт в ender.lua и откройте сайт через локальный сервер, либо нажмите «Загрузить .lua».";
                enderCode.classList.add("ss-code--muted");
            }
        }
    }

    function loadEnderFromStorage() {
        try {
            var ls = localStorage.getItem(ENDER_STORAGE_KEY);
            if (ls && ls.length > 40) {
                setEnderDisplay(ls);
                return true;
            }
        } catch (e) {
        }
        return false;
    }

    function loadEnderFromFetch() {
        fetch("ender.lua", { cache: "no-store" })
            .then(function (r) {
                return r.ok ? r.text() : "";
            })
            .then(function (t) {
                if (!t || t.length < 40) {
                    return;
                }
                if (t.indexOf("загрузите файл в интерфейсе WAVE SS") !== -1 && t.length < 2500) {
                    return;
                }
                if (enderSourceText && enderSourceText.length > t.length) {
                    return;
                }
                setEnderDisplay(t);
            })
            .catch(function () {});
    }

    function init() {
        try {
            sessionStorage.removeItem("wave_ss_guest");
            if (sessionStorage.getItem("wave_ss_unlocked") === "1") {
                sessionStorage.removeItem("wave_ss_unlocked");
            }
        } catch (e) {
        }
        if (caducusCode) {
            caducusCode.textContent = CADUCUS();
        }
        if (serverAdminCode) {
            serverAdminCode.textContent = SERVER_ADMIN();
        }
        if (gonerCode) {
            gonerCode.textContent = GONER();
        }
        if (waveUniversalCode) {
            waveUniversalCode.textContent = WAVE_UNIVERSAL();
        }
        updateWaveVaultUI();
        updateNeonFromSliders();
        buildScriptGrid();
        selectScriptCard("caducus");
        if (!restoreSessionUnlock()) {
            setLayoutMode(false);
            setOverlayVisible(true);
        }
        syncSsSidebarNav("home");
    }

    keyForm.addEventListener("submit", function (event) {
        event.preventDefault();
        tryUnlockFromInput();
    });

    toggleVisibility.addEventListener("click", function () {
        if (keyInput.type === "password") {
            keyInput.type = "text";
            toggleVisibility.setAttribute("title", "Скрыть ключ");
            toggleVisibility.setAttribute("aria-label", "Скрыть ключ");
        } else {
            keyInput.type = "password";
            toggleVisibility.setAttribute("title", "Показать ключ");
            toggleVisibility.setAttribute("aria-label", "Показать ключ");
        }
    });

    openKeyAgain.addEventListener("click", function () {
        setOverlayVisible(true);
    });

    var ubi;
    for (ubi = 0; ubi < goUnlockButtons.length; ubi++) {
        goUnlockButtons[ubi].addEventListener("click", function () {
            setOverlayVisible(true);
        });
    }

    vaultToggle.addEventListener("click", function () {
        var open = vaultBody.hidden;
        vaultBody.hidden = !open;
        vaultToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    pickWave.addEventListener("click", function () {
        startWaveProtocol();
    });

    if (pickPremium) {
        pickPremium.addEventListener("click", function () {
            startPremiumProtocol();
        });
    }

    simonPads.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-simon-idx]");
        if (!btn || vaultSimonPlaying || btn.disabled) {
            return;
        }
        var idx = parseInt(btn.getAttribute("data-simon-idx"), 10);
        onSimonPadClick(idx);
    });

    vaultQuizInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            vaultQuizSubmit.click();
        }
    });

    vaultQuizSubmit.addEventListener("click", function () {
        if (vaultMode === "premium") {
            var rawp = vaultQuizInput.value.trim().replace(/\s/g, "");
            if (!/^\d+$/.test(rawp)) {
                vaultQuizError.textContent = "Введите целое число.";
                vaultQuizError.hidden = false;
                return;
            }
            var np = parseInt(rawp, 10);
            if (np !== vaultQuizAnswer) {
                vaultQuizError.textContent = "Ответ неверный. Попробуйте снова.";
                vaultQuizError.hidden = false;
                return;
            }
            vaultQuizError.hidden = true;
            finalizeVaultIssuance();
            return;
        }
        if (vaultMode === "wave") {
            if (vaultQuizIsNumeric) {
                var raw = vaultQuizInput.value.trim().replace(/\s/g, "");
                if (!/^\d+$/.test(raw)) {
                    vaultQuizError.textContent = "Введите целое число.";
                    vaultQuizError.hidden = false;
                    return;
                }
                var n = parseInt(raw, 10);
                if (n !== vaultQuizAnswer) {
                    vaultQuizError.textContent = "Ответ неверный. Попробуйте снова.";
                    vaultQuizError.hidden = false;
                    return;
                }
            } else {
                var got = normalizeQuizText(vaultQuizInput.value);
                if (got !== vaultQuizAnswerStr) {
                    vaultQuizError.textContent = "Неверный токен. Проверьте ввод.";
                    vaultQuizError.hidden = false;
                    return;
                }
            }
            vaultQuizError.hidden = true;
            onWaveAdvanceAfterSuccess();
        }
    });

    vaultCopyKey.addEventListener("click", function () {
        var text = vaultResultKey.textContent;
        var revert = function () {
            vaultCopyKey.textContent = "Копировать ключ";
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                vaultCopyKey.textContent = "Скопировано";
                window.setTimeout(revert, 2000);
            });
        } else {
            var ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            vaultCopyKey.textContent = "Скопировано";
            window.setTimeout(revert, 2000);
        }
    });

    vaultRestart.addEventListener("click", function () {
        vaultMode = null;
        waveVaultStep = 0;
        updateWaveVaultUI();
        showVaultPhase("pick");
        simonStatus.textContent = "";
    });

    tabHome.addEventListener("click", function () {
        switchTab("home");
    });

    tabVisuals.addEventListener("click", function () {
        if (tabVisuals.disabled) {
            return;
        }
        switchTab("visuals");
    });

    tabPlayers.addEventListener("click", function () {
        if (tabPlayers.disabled) {
            return;
        }
        switchTab("players");
    });

    tabScripts.addEventListener("click", function () {
        if (tabScripts.disabled) {
            return;
        }
        switchTab("scripts");
    });

    if (copyCaducus) {
        copyCaducus.addEventListener("click", function () {
            var text = CADUCUS();
            var revert = function () {
                copyCaducus.textContent = "Copy";
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    copyCaducus.textContent = "Copied";
                    window.setTimeout(revert, 2000);
                });
            } else {
                var ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                copyCaducus.textContent = "Copied";
                window.setTimeout(revert, 2000);
            }
        });
    }

    if (copyServerAdmin && serverAdminCode) {
        copyServerAdmin.addEventListener("click", function () {
            var text = SERVER_ADMIN();
            var revert = function () {
                copyServerAdmin.textContent = "Copy";
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    copyServerAdmin.textContent = "Copied";
                    window.setTimeout(revert, 2000);
                });
            } else {
                var ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                copyServerAdmin.textContent = "Copied";
                window.setTimeout(revert, 2000);
            }
        });
    }

    if (copyGoner && gonerCode) {
        copyGoner.addEventListener("click", function () {
            var text = GONER();
            var revert = function () {
                copyGoner.textContent = "Copy";
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    copyGoner.textContent = "Copied";
                    window.setTimeout(revert, 2000);
                });
            } else {
                var ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                copyGoner.textContent = "Copied";
                window.setTimeout(revert, 2000);
            }
        });
    }

    if (copyGrabKnifeV3 && grabKnifeV3Code) {
        copyGrabKnifeV3.addEventListener("click", function () {
            (async function () {
                await ensureGrabKnifeV3Loaded();
                var text = String(grabKnifeV3Code.textContent || "");
                if (!text.trim() || text.indexOf("Failed to load") !== -1) {
                    copyGrabKnifeV3.textContent = "Load failed";
                    window.setTimeout(function () {
                        copyGrabKnifeV3.textContent = "Copy";
                    }, 2000);
                    return;
                }
                var revert = function () {
                    copyGrabKnifeV3.textContent = "Copy";
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        copyGrabKnifeV3.textContent = "Copied";
                        window.setTimeout(revert, 2000);
                    });
                } else {
                    var ta = document.createElement("textarea");
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                    copyGrabKnifeV3.textContent = "Copied";
                    window.setTimeout(revert, 2000);
                }
            })();
        });
    }

    if (copyWaveUniversal && waveUniversalCode) {
        copyWaveUniversal.addEventListener("click", function () {
            var text = String(waveUniversalCode.textContent || "");
            if (!text.trim()) {
                text = WAVE_UNIVERSAL();
            }
            var revert = function () {
                copyWaveUniversal.textContent = "Copy";
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    copyWaveUniversal.textContent = "Copied";
                    window.setTimeout(revert, 2000);
                });
            } else {
                var ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                copyWaveUniversal.textContent = "Copied";
                window.setTimeout(revert, 2000);
            }
        });
    }

    if (adminReloadPlayers) {
        adminReloadPlayers.addEventListener("click", function () {
            if (!fbDb) {
                setAuthStatus("Firestore not ready.");
                return;
            }
            if (adminStatus) {
                adminStatus.textContent = "Reloading players...";
            }
            subscribePlayers();
            window.setTimeout(function () {
                if (adminStatus && adminStatus.textContent === "Reloading players...") {
                    adminStatus.textContent = "Admin is online.";
                }
            }, 1200);
        });
    }

    if (enderFile) {
        enderFile.addEventListener("change", function () {
            var f = enderFile.files && enderFile.files[0];
            if (!f) {
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                setEnderDisplay(String(reader.result || ""));
            };
            reader.readAsText(f);
            enderFile.value = "";
        });
    }

    if (enderSaveLs) {
        enderSaveLs.addEventListener("click", function () {
            try {
                localStorage.setItem(ENDER_STORAGE_KEY, enderSourceText);
                var prev = enderSaveLs.textContent;
                enderSaveLs.textContent = "Saved";
                window.setTimeout(function () {
                    enderSaveLs.textContent = prev;
                }, 2000);
            } catch (e) {
                enderSaveLs.textContent = "Error";
                window.setTimeout(function () {
                    enderSaveLs.textContent = "Save local";
                }, 2000);
            }
        });
    }

    if (copyEnder) {
        copyEnder.addEventListener("click", function () {
            var text = ENDER();
            if (!text || !text.trim()) {
                copyEnder.textContent = "No code";
                window.setTimeout(function () {
                    copyEnder.textContent = "Copy Ender";
                }, 2000);
                return;
            }
            var revert = function () {
                copyEnder.textContent = "Copy Ender";
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    copyEnder.textContent = "Copied";
                    window.setTimeout(revert, 2000);
                });
            } else {
                var ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                copyEnder.textContent = "Copied";
                window.setTimeout(revert, 2000);
            }
        });
    }

    if (scriptsSearch) {
        scriptsSearch.addEventListener("input", function () {
            var q = scriptsSearch.value.toLowerCase().trim();
            document.querySelectorAll(".ss-script-card").forEach(function (card) {
                var hay =
                    (card.getAttribute("data-script-name") || "") +
                    " " +
                    (card.getAttribute("data-script-title") || "").toLowerCase() +
                    " " +
                    (card.getAttribute("data-script-desc") || "").toLowerCase() +
                    " " +
                    card.textContent.toLowerCase();
                card.hidden = q.length > 0 && hay.indexOf(q) === -1;
            });
        });
    }

    document.querySelectorAll(".ss-nav-item[data-tab]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var tab = btn.getAttribute("data-tab");
            if (btn.disabled) {
                return;
            }
            switchTab(tab);
            closeSsSidebar();
        });
    });

    var ssToggle = document.getElementById("ss-sidebar-toggle");
    var ssSidebar = document.getElementById("ss-sidebar");
    if (ssToggle && ssSidebar) {
        ssToggle.addEventListener("click", function () {
            var open = !ssSidebar.classList.contains("is-open");
            ssSidebar.classList.toggle("is-open", open);
            ssToggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
    }

    var ssOpenKey = document.getElementById("ss-open-key");
    if (ssOpenKey) {
        ssOpenKey.addEventListener("click", function () {
            (async function () {
                setAuthStatus("Signing out...");
                try {
                    if (fbAuth) {
                        await fbAuth.signOut();
                    }
                } catch (e) {}
                setAdminAccess(false);
                if (playersUnsub) {
                    try {
                        playersUnsub();
                    } catch (e2) {}
                    playersUnsub = null;
                }
                if (playersList) {
                    playersList.innerHTML = "";
                    var li = document.createElement("li");
                    li.className = "player-item";
                    li.setAttribute("role", "listitem");
                    li.innerHTML =
                        '<span class="player-avatar"></span><span class="player-name">Not logged in.</span>';
                    playersList.appendChild(li);
                }
                setAuthStatus("Not logged in.");
                if (openKeyAgain) {
                    openKeyAgain.click();
                }
                try {
                    switchTab("home");
                } catch (e3) {}
            })();
        });
    }

    document.querySelectorAll(".ss-tab[data-ss-tab]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            setSsLibraryTab(btn.getAttribute("data-ss-tab") || "public");
        });
    });

    var ssTabsSelect = document.getElementById("ss-tabs-select");
    if (ssTabsSelect) {
        ssTabsSelect.addEventListener("change", function () {
            setSsLibraryTab(ssTabsSelect.value || "public");
        });
    }

    var ssScriptGrid = document.getElementById("ss-script-grid");
    if (ssScriptGrid) {
        ssScriptGrid.addEventListener("click", function (event) {
            var card = event.target.closest(".ss-script-card");
            if (!card || !ssScriptGrid.contains(card)) {
                return;
            }
            selectScriptCard(card.getAttribute("data-script-name") || "caducus");
        });
    }

    document.addEventListener("click", function (event) {
        if (!panelScripts || panelScripts.hidden) {
            return;
        }
        var t = event.target;
        if (!ssSidebar || !ssToggle || !ssSidebar.classList.contains("is-open")) {
            return;
        }
        if (ssSidebar.contains(t) || ssToggle.contains(t)) {
            return;
        }
        closeSsSidebar();
    });

    document.querySelectorAll(".brand-link[data-tab], .ss-logo-link[data-tab]").forEach(function (link) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            switchTab("home");
        });
    });

    sliderR.addEventListener("input", updateNeonFromSliders);
    sliderG.addEventListener("input", updateNeonFromSliders);
    sliderB.addEventListener("input", updateNeonFromSliders);
    sliderIntensity.addEventListener("input", updateNeonFromSliders);
    resetNeon.addEventListener("click", resetNeonDefaults);

    keyOverlay.addEventListener("click", function (event) {
        if (event.target === keyOverlay && document.body.classList.contains("wave-unlocked")) {
            setOverlayVisible(false);
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && document.body.classList.contains("wave-unlocked")) {
            if (!keyOverlay.classList.contains("is-hidden")) {
                setOverlayVisible(false);
            }
        }
    });

    window.CADUCUS = CADUCUS;
    window.SERVER_ADMIN = SERVER_ADMIN;
    window.GONER = GONER;

    // Firebase OAuth / Firestore players list
    initFirebaseAuthStub();

    init();
})();
