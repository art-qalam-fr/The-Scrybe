from keyboard import is_pressed, unhook_all, hook
import threading
import queue
import time
import ctypes
import os
import logging

logger = logging.getLogger("hotkey_manager")

# GetAsyncKeyState direct : l'etat clavier en temps reel, sans dependre du hook
# bas-niveau de `keyboard`. is_pressed() lit en fait la table _pressed_events
# alimentee par ce hook — et Windows DETRUIT silencieusement le hook quand le
# callback depasse le timeout (charge Whisper) -> raccourcis morts. VK generique
# = gauche ET droit (VK_CONTROL, VK_MENU, VK_SHIFT).
_USER32 = ctypes.windll.user32 if os.name == "nt" else None

_GENERIC_VK = {
    "ctrl": 0x11, "control": 0x11,
    "alt": 0x12, "menu": 0x12, "alt_gr": 0x12,
    "shift": 0x10,
    "win": 0x5B, "cmd": 0x5B, "windows": 0x5B, "super": 0x5B,
    "space": 0x20, "enter": 0x0D, "return": 0x0D, "tab": 0x09,
    "escape": 0x1B, "esc": 0x1B, "backspace": 0x08, "delete": 0x2E,
    "up": 0x26, "down": 0x28, "left": 0x25, "right": 0x27,
    "caps lock": 0x14, "num lock": 0x90, "scroll lock": 0x91,
    "print screen": 0x2C, "insert": 0x2D, "home": 0x24, "end": 0x23,
    "page up": 0x21, "page down": 0x22,
}


def _vk_for(name):
    n = name.lower().strip()
    for prefix in ("left ", "right "):
        if n.startswith(prefix):
            n = n[len(prefix):]
    if n in _GENERIC_VK:
        return _GENERIC_VK[n]
    if n.startswith("f") and n[1:].isdigit() and 1 <= int(n[1:]) <= 24:
        return 0x6F + int(n[1:])  # F1 = 0x70
    if len(n) == 1 and n.isascii() and _USER32 is not None:
        return _USER32.VkKeyScanW(ord(n)) & 0xFF
    return None


def _is_key_down(name):
    if _USER32 is not None:
        vk = _vk_for(name)
        if vk is not None:
            return bool(_USER32.GetAsyncKeyState(vk) & 0x8000)
    # Hors Windows ou touche non resolue : repli sur la lib keyboard.
    try:
        return is_pressed(name)
    except Exception:
        return False


class HotkeyManager:
    def __init__(self, app):
        self.app = app
        self.is_recording = False
        self.push_to_block_active = False
        self.ctrl_alt_pressed = False
        self.ctrl_shift_pressed = False
        self.current_keys = set()
        self._block_latch = False
        self._poll_stop = threading.Event()
        self._poll_thread = None
        # Canal secondaire : événements du hook bas-niveau `keyboard`. Si
        # GetAsyncKeyState devient aveugle dans ce process (observé en
        # production : thread vivant, état clavier lu = toujours vide), le
        # hook livre quand même les appuis — et inversement si Windows tue
        # le hook sous charge, le polling couvre. name -> timestamp press.
        self._hook_pressed = {}
        self._hook_lock = threading.Lock()

        self._actions = queue.Queue()
        self._worker = threading.Thread(target=self._action_worker, daemon=True)
        self._worker.start()

        self.reload_shortcuts()

    def _action_worker(self):
        while True:
            action = self._actions.get()
            try:
                action()
            except Exception:
                logger.exception("Erreur action hotkey")
            finally:
                self._actions.task_done()

    def _start_ptt(self):
        self.app.start_hold_recording()
        self.is_recording = bool(getattr(self.app, "is_recording", False))

    def _start_block(self):
        self.app.start_hold_recording()
        if not getattr(self.app, "is_recording", False):
            self.push_to_block_active = False
            self.is_recording = False

    def _get_key_name(self, key):
        """Convertit une touche en nom standardisé.

        La lib `keyboard` rapporte les modifieurs gauche/droit sous la forme
        'left ctrl'/'right ctrl' (et 'alt gr'). On normalise vers les noms
        courts attendus par _check_shortcut_match ('ctrl', 'alt', 'shift').
        """
        if hasattr(key, "name"):
            name = key.name
        elif hasattr(key, "char"):
            name = key.char
        else:
            name = str(key)
        if not name:
            return None
        name = name.lower().strip()
        for prefix in ("left ", "right "):
            if name.startswith(prefix):
                name = name[len(prefix):]
        if name == "alt gr":
            return "alt_gr"
        return name

    def _is_key_pressed(self, key_name):
        return key_name in [self._get_key_name(k) for k in self.current_keys]

    def reload_shortcuts(self):
        if hasattr(self.app, "shortcuts"):
            self.shortcuts = self.app.shortcuts.copy()
            print(f"Raccourcis rechargés: {self.shortcuts}")
        else:
            self.shortcuts = {
                'push_to_talk': ['Ctrl', 'Alt'],
                'push_to_block': ['Ctrl', 'Shift']
            }
            print("Raccourcis par défaut utilisés")
        # Touches à sonder : union de tous les combos configurés.
        watched = {"ctrl", "alt", "shift"}
        for keys in self.shortcuts.values():
            if isinstance(keys, (list, tuple)):
                watched.update(str(k).strip().lower() for k in keys if k)
        self._watched_keys = watched

    def _hook_event(self, event):
        """Callback du hook `keyboard` — canal secondaire. Garde le handler
        minuscule : il s'exécute dans le thread du hook, et une lenteur ici
        est justement ce qui faisait sauter le hook par timeout Windows."""
        try:
            name = self._get_key_name(getattr(event, "name", None))
            if not name:
                return
            with self._hook_lock:
                if event.event_type == "down":
                    self._hook_pressed[name] = time.monotonic()
                else:
                    self._hook_pressed.pop(name, None)
        except Exception:
            pass

    def _read_pressed_keys(self):
        """État réel du clavier via GetAsyncKeyState — autoritaire : l'état
        matériel est interrogé directement, sans passer par la table
        _pressed_events du hook de la lib keyboard (que Windows détruit
        silencieusement sous charge -> détection erratique "une fois sur
        deux" puis raccourcis définitivement morts). Union avec les events
        du hook : chaque canal couvre la panne de l'autre.
        """
        keys = {name for name in self._watched_keys if _is_key_down(name)}
        now = time.monotonic()
        with self._hook_lock:
            # Expiration : si un "release" est perdu (hook tué par Windows),
            # la touche ne reste pas fantôme au-delà de 5 min.
            stale = [n for n, t in self._hook_pressed.items() if now - t > 300]
            for n in stale:
                del self._hook_pressed[n]
            keys |= set(self._hook_pressed)
        return keys

    def _poll_loop(self):
        last_seen = frozenset()
        while not self._poll_stop.is_set():
            try:
                self.current_keys = self._read_pressed_keys()
                self._evaluate()
                seen = frozenset(self.current_keys)
                if seen != last_seen:
                    # Transition clavier réellement observée par le poller —
                    # si ce log ne bouge jamais pendant un appui, GetAsyncKeyState
                    # est aveugle dans ce process (diagnostic production).
                    logger.debug("poll keys: %s", sorted(seen))
                    last_seen = seen
            except BaseException:
                # BaseException volontairement : SystemExit/KeyboardInterrupt
                # traversent "except Exception" et tueraient le thread sans
                # trace. Le logger fichier ne peut pas bloquer sur un pipe
                # Electron plein (contrairement à print -> thread mort muet).
                logger.exception("Erreur poll hotkey")
            self._poll_stop.wait(0.04)

    def _poll_supervisor(self):
        """Watchdog : si le thread de polling meurt malgré tout (blocage OS,
        erreur native), il est relancé — sinon les raccourcis mouraient
        définitivement après un cycle enregistrement+injection."""
        while not self._poll_stop.is_set():
            t = self._poll_thread
            if t is None or not t.is_alive():
                logger.error("Thread de polling hotkey mort — redémarrage")
                self._poll_thread = threading.Thread(
                    target=self._poll_loop, daemon=True
                )
                self._poll_thread.start()
            self._poll_stop.wait(1.0)

    @property
    def poll_alive(self):
        return self._poll_thread is not None and self._poll_thread.is_alive()

    @property
    def poll_debug(self):
        """État interne du poller exposé via /api/status — diagnostic des
        raccourcis qui 'ne déclenchent rien' sans erreur visible."""
        return {
            "alive": self.poll_alive,
            "watched": sorted(self._watched_keys),
            "current": sorted(self.current_keys),
            "shortcuts": self.shortcuts,
        }

    def _evaluate(self):
        """Transitions d'état communes, évaluées à chaque tick du poller et par
        les handlers d'events conservés pour les tests/smoke."""
        if getattr(self.app, "editing_shortcut", False):
            return

        ptt_match = self._check_shortcut_match("push_to_talk")
        block_match = self._check_shortcut_match("push_to_block")

        if self.push_to_block_active and not getattr(
            self.app, "is_recording", False
        ):
            self.push_to_block_active = False
            self.is_recording = False

        if block_match:
            if not self._block_latch:
                self._block_latch = True
                if self.push_to_block_active:
                    self.push_to_block_active = False
                    self.is_recording = False
                    self._actions.put(self.app.stop_hold_recording)
                else:
                    self.push_to_block_active = True
                    if not self.is_recording:
                        self._actions.put(self._start_block)
                    self.is_recording = True
        else:
            self._block_latch = False

        if self.is_recording and not self.push_to_block_active:
            if not ptt_match:
                self.is_recording = False
                self._actions.put(self.app.stop_hold_recording)
        elif ptt_match and not self.is_recording and not self.push_to_block_active:
            self.is_recording = True
            self._actions.put(self._start_ptt)

    def _check_shortcut_match(self, shortcut_name):
        if shortcut_name not in self.shortcuts:
            return False

        required_keys = [key.lower() for key in self.shortcuts[shortcut_name]]
        current_key_names = [self._get_key_name(k) for k in self.current_keys]

        for required_key in required_keys:
            key_pressed = False
            if required_key == "ctrl":
                key_pressed = any(
                    k in ["ctrl_l", "ctrl_r", "ctrl"] for k in current_key_names
                )
            elif required_key == "alt":
                key_pressed = any(
                    k in ["alt_l", "alt_r", "alt_gr", "alt"] for k in current_key_names
                )
            elif required_key == "shift":
                key_pressed = any(
                    k in ["shift_l", "shift_r", "shift"] for k in current_key_names
                )
            else:
                key_pressed = required_key in current_key_names

            if not key_pressed:
                return False

        return True

    def on_key_press(self, key):
        """Conservé pour le smoke test (simulation d'events) — non utilisé en
        production, le poller est la source de vérité."""
        try:
            key_name = self._get_key_name(key)
            if key_name:
                self.current_keys.add(key_name)
            self._evaluate()
        except Exception as e:
            print(f"Erreur hotkey press: {e}")

    def on_key_release(self, key):
        """Conservé pour le smoke test — voir on_key_press."""
        try:
            released_name = self._get_key_name(key)
            key_to_remove = None
            if released_name:
                for k in self.current_keys:
                    if self._get_key_name(k) == released_name:
                        key_to_remove = k
                        break
            if key_to_remove:
                self.current_keys.remove(key_to_remove)
            self._evaluate()
        except Exception as e:
            print(f"Erreur hotkey release: {e}")

    def start(self):
        print("\n=== DÉMARRAGE DU GESTIONNAIRE DE RACCOURCIS ===")
        ptt_shortcut = "+".join(self.shortcuts.get("push_to_talk", ["Ctrl", "Alt"]))
        block_shortcut = "+".join(
            self.shortcuts.get("push_to_block", ["Ctrl", "Shift"])
        )
        print(f"1. Push-to-Talk: Maintenez {ptt_shortcut} enfoncés pour enregistrer")
        print(
            f"2. Push-to-Block: Appuyez sur {block_shortcut} pour activer/désactiver l'enregistrement"
        )

        # Polling GetAsyncKeyState à 25 Hz : aucun hook bas-niveau à perdre
        # (sous charge Whisper le callback pouvait dépasser le timeout Windows
        # et le hook sautait silencieusement -> raccourcis morts aléatoires).
        self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._poll_thread.start()
        self._supervisor = threading.Thread(
            target=self._poll_supervisor, daemon=True
        )
        self._supervisor.start()
        # Canal secondaire : hook bas-niveau alimentant _hook_pressed. Il ne
        # sert plus de source de vérité (le polling le fait déjà) mais livre
        # les appuis si GetAsyncKeyState devient aveugle dans ce process.
        try:
            hook(self._hook_event)
        except Exception:
            logger.exception("Impossible d'installer le hook secondaire — polling seul")
        print("Gestionnaire de raccourcis démarré avec succès (polling)")

    def stop(self):
        self._poll_stop.set()
        unhook_all()
        if self.is_recording:
            self.app.stop_hold_recording()
