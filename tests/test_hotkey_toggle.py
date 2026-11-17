"""Smoke test : push-to-block toggle (bug B1) — simule press/release sans listener réel.

Les touches sont des strings de style pynput ('ctrl_l', 'shift', 'alt_l') :
_get_key_name les normalise pareil que les objets Key — ainsi le test ne
dépend pas de pynput (qui exige un display X11 en CI Linux).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from unittest.mock import MagicMock
from hotkey_manager import HotkeyManager


class Key:
    """Alias de commodité : noms de touches tels que normalisés par _get_key_name."""
    ctrl_l = 'ctrl_l'
    ctrl_r = 'ctrl_r'
    shift_l = 'shift'
    alt_l = 'alt_l'
    alt_gr = 'alt_gr'


app = MagicMock()
app.editing_shortcut = False
app.shortcuts = {'push_to_talk': ['Ctrl', 'Alt'], 'push_to_block': ['Ctrl', 'Shift']}

hm = HotkeyManager(app)

def press(*keys):
    for k in keys:
        hm.on_key_press(k)

def release(*keys):
    for k in reversed(keys):
        hm.on_key_release(k)

fails = []

def drain():
    # Les appels backend passent par une queue asynchrone (le thread du hook
    # ne doit jamais bloquer) : attendre que le worker ait tout consommé
    hm._actions.join()

# Test 1 : push-to-block ON puis OFF (avant : impossible d'éteindre)
press(Key.ctrl_l, Key.shift_l)
assert hm.push_to_block_active and hm.is_recording, "B1: block ne démarre pas"
drain()
assert app.start_hold_recording.call_count == 1

press(Key.ctrl_l, Key.shift_l)  # key-repeat : ne doit PAS re-toggler
assert hm.push_to_block_active, "B1: key-repeat a re-togglé (latch absent)"

release(Key.shift_l, Key.ctrl_l)
press(Key.ctrl_l, Key.shift_l)  # nouvel appui -> OFF
assert not hm.push_to_block_active and not hm.is_recording, "B1: block ne s'arrête pas"
drain()
assert app.stop_hold_recording.call_count == 1

# Test 2 : PTT hold/release
press(Key.ctrl_l, Key.alt_l)
assert hm.is_recording, "PTT ne démarre pas"
drain()
release(Key.alt_l)  # relâcher une touche du combo -> stop
assert not hm.is_recording, "PTT ne s'arrête pas au relâchement"
drain()
assert app.stop_hold_recording.call_count == 2

# Test 3 : block pendant PTT actif -> refusé (conflit de modes, constat ACP)
press(Key.ctrl_l, Key.alt_l)
assert hm.is_recording
drain()
press(Key.shift_l)  # Ctrl+Shift pendant PTT
drain()
assert not hm.push_to_block_active, "block s'est activé par-dessus le PTT"
release(Key.alt_l, Key.ctrl_l, Key.shift_l)
drain()

# Test 4 : resync — block actif puis stop extérieur via UI/API (is_recording=False)
app.is_recording = False  # simule un arrêt extérieur
hm.push_to_block_active = True
hm.is_recording = True
starts_before = app.start_hold_recording.call_count
press(Key.ctrl_l, Key.shift_l)
drain()
# Sans resync, ce 1er appui ne faisait que purger le flag fantôme (toggle OFF).
# Avec : le flag est purgé PUIS l'appui démarre normalement -> tentative de start.
# (le mock is_recording=False simule un échec de démarrage -> retour au repos)
assert app.start_hold_recording.call_count == starts_before + 1, \
    "resync : l'appui a été absorbé par le flag fantôme"
assert not hm.push_to_block_active, "resync : état incohérent"

print("PASS" if not fails else f"FAIL {fails}")
