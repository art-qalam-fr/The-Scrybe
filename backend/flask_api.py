#!/usr/bin/env python3
import sys
import os

# Logs persistants AVANT tout le reste : capture aussi les logs d'init
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import logging_setup
logging_setup.init()

from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import json
import queue
import threading
import logging

# Werkzeug silencieux (spam de requêtes) — mais le root reste à INFO :
# logging_setup a installé le handler fichier qui doit tout recevoir
logging.getLogger('werkzeug').setLevel(logging.ERROR)

# Ajouter le chemin actuel pour les imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_logic import BackendLogic

app = Flask(__name__)
CORS(app)

# Instance globale
logic = BackendLogic()

SCRYBE_IDENTITY = "The-Scrybe/backend"


@app.after_request
def announce_identity(response):
    """Banniere d'identite sur chaque reponse : les scanners de ports
    (Cerber Security Shield) voient 'X-Scrybe: The-Scrybe/backend' au lieu
    d'un serveur HTTP anonyme."""
    response.headers['X-Scrybe'] = SCRYBE_IDENTITY
    return response


@app.route('/api/identity')
def identity():
    """Carte d'identite du processus : nom, role, port, pid.
    Permet a un scanner de savoir qui occupe :5000 sans deviner."""
    return jsonify({
        'app': 'The Scrybe',
        'component': 'backend',
        'banner': SCRYBE_IDENTITY,
        'port': int(os.environ.get('PORT', 5000)),
        'pid': os.getpid(),
        'exe': os.path.basename(sys.executable),
    })

# ---------------------------------------------------------------------------
# SSE — Server-Sent Events : le backend Pousse les changements d'état vers les
# clients (fenêtre principale + widget) au lieu d'être interrogé en polling.
# Une connexion /api/events par client ; les commandes restent en POST REST.
# ---------------------------------------------------------------------------
_sse_subscribers = []
_sse_lock = threading.Lock()


def publish_event(event_type, data=None):
    """Appelé par BackendLogic à chaque changement d'état notable."""
    msg = json.dumps({'type': event_type, 'data': data})
    with _sse_lock:
        subscribers = list(_sse_subscribers)
    for q in subscribers:
        try:
            q.put_nowait(msg)
        except queue.Full:
            pass  # client lent : on saute l'événement plutôt que de bloquer


logic.set_event_publisher(publish_event)


@app.route('/api/events')
def events():
    q = queue.Queue(maxsize=100)
    with _sse_lock:
        _sse_subscribers.append(q)

    def stream():
        try:
            # État initial envoyé à la connexion
            yield f"data: {json.dumps({'type': 'status', 'data': logic.get_status()})}\n\n"
            while True:
                try:
                    yield f"data: {q.get(timeout=25)}\n\n"
                except queue.Empty:
                    yield ": keepalive\n\n"  # maintient la connexion (proxy/timeout)
        finally:
            with _sse_lock:
                if q in _sse_subscribers:
                    _sse_subscribers.remove(q)

    return Response(stream(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@app.route('/api/status')
def get_status():
    return jsonify(logic.get_status())

@app.route('/api/devices')
def get_devices():
    return jsonify({'devices': logic.list_devices()})

@app.route('/api/device', methods=['POST'])
def set_device():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corps JSON invalide'}), 400
    device_id = data.get('id')
    if device_id is not None and logic.set_device(device_id):
        return jsonify({'success': True})
    return jsonify({'error': 'Périphérique invalide'}), 400

@app.route('/api/settings/quality', methods=['POST'])
def set_quality():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corps JSON invalide'}), 400
    quality = data.get('quality')
    if quality and logic.set_quality(quality):
        return jsonify({'success': True})
    return jsonify({'error': 'Qualité invalide'}), 400

@app.route('/api/settings/language', methods=['POST'])
def set_language():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corps JSON invalide'}), 400
    lang = data.get('language')
    if lang and logic.set_language(lang):
        return jsonify({'success': True})
    return jsonify({'error': 'Langue invalide'}), 400

@app.route('/api/shortcuts', methods=['GET', 'POST'])
def handle_shortcuts():
    if request.method == 'POST':
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({'error': 'Corps JSON invalide'}), 400
        shortcuts = data.get('shortcuts')
        if shortcuts:
            logic.save_shortcuts(shortcuts)
            return jsonify({'success': True})
        return jsonify({'error': 'Données invalides'}), 400
    return jsonify({'shortcuts': logic.load_shortcuts()})

@app.route('/api/engines')
def get_engines():
    """Liste les moteurs locaux + cloud (avec état de configuration clé)."""
    import engines
    return jsonify({'engines': engines.available_engines(key_resolver=logic.engine_setting), 'current': logic.engine_name})


@app.route('/api/settings/engine_config', methods=['POST'])
def set_engine_config():
    """Enregistre la clé API d'un provider cloud (+ base_url/modèle pour 'custom').
    La clé est persistée en DB locale et jamais renvoyée au frontend."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corps JSON invalide'}), 400
    provider = data.get('provider')
    if provider and logic.set_engine_config(
        provider,
        key=data.get('key'),
        base_url=data.get('base_url'),
        model=data.get('model'),
    ):
        return jsonify({'success': True})
    return jsonify({'error': 'Provider invalide'}), 400


@app.route('/api/settings/engine', methods=['POST'])
def set_engine():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corps JSON invalide'}), 400
    engine = data.get('engine')
    if engine and logic.set_engine(engine):
        return jsonify({'success': True})
    return jsonify({'error': 'Moteur invalide ou non installé'}), 400


@app.route('/api/settings/theme', methods=['POST'])
def set_theme():
    appearance_data = request.get_json(silent=True)
    # set_theme accepte un dict (apparence complète) ou une str (variante de thème)
    if not isinstance(appearance_data, (dict, str)):
        return jsonify({'error': 'Données d\'apparence invalides'}), 400
    if logic.set_theme(appearance_data):
        return jsonify({'success': True})
    return jsonify({'error': 'Données d\'apparence invalides'}), 400

@app.route('/api/settings/widget_theme', methods=['POST'])
def set_widget_theme():
    """Apparence du widget flottant — indépendante de celle du dashboard."""
    appearance_data = request.get_json(silent=True)
    if not isinstance(appearance_data, dict):
        return jsonify({'error': 'Données d\'apparence invalides'}), 400
    if logic.set_widget_appearance(appearance_data):
        return jsonify({'success': True})
    return jsonify({'error': 'Données d\'apparence invalides'}), 400

@app.route('/api/start_recording', methods=['POST'])
def start_recording():
    logic.start_recording()
    return jsonify({'success': True})

@app.route('/api/stop_recording', methods=['POST'])
def stop_recording():
    logic.stop_recording()
    return jsonify({'success': True})

@app.route('/api/toggle_recording', methods=['POST'])
def toggle_recording():
    logic.toggle_recording()
    return jsonify({'success': True})

@app.route('/api/history')
def get_history():
    return jsonify({'history': logic.get_history()})

@app.route('/api/log', methods=['POST'])
def frontend_log():
    """Les renderers React remontent leurs erreurs ici -> logs/frontend.log"""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'JSON object attendu'}), 400
    level = str(data.get('level', 'info')).lower()
    source = str(data.get('source', 'ui'))[:50]
    message = str(data.get('message', ''))[:4000]
    lvl = {'debug': 10, 'info': 20, 'warning': 30, 'error': 40}.get(level, 20)
    logging_setup.frontend_logger().log(lvl, '[%s] %s', source, message)
    return jsonify({'ok': True})

@app.route('/api/delete_transcription/<int:id>', methods=['DELETE'])
def delete_transcription(id):
    if logic.delete_transcription(id):
        return jsonify({'success': True})
    return jsonify({'error': 'Transcription non trouvée'}), 404

@app.route('/api/languages')
def get_languages():
    # Liste simplifiée pour l'instant, peut être étendue
    return jsonify({
        'languages': {
            'fr': 'Français',
            'en': 'Anglais',
            'es': 'Espagnol',
            'de': 'Allemand',
            'it': 'Italien',
            'ja': 'Japonais',
            'zh': 'Chinois'
        },
        'current': logic.current_language
    })

def _backend_already_running(port):
    """Sous Windows, SO_REUSEADDR permet le double-bind du port : deux backends
    peuvent écouter sur :5000 en même temps, chacun avec son propre listener
    pynput -> hotkeys traitées deux fois. On sonde l'API plutôt que le bind."""
    try:
        import urllib.request
        urllib.request.urlopen(f'http://127.0.0.1:{port}/api/status', timeout=2)
        return True
    except Exception:
        return False


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    if _backend_already_running(port):
        print(f"⚠️ Un backend répond déjà sur :{port} — cette instance s'arrête "
              "(sinon double listener hotkeys + états désynchronisés)")
        sys.exit(0)
    print(f"🚀 Backend API démarré sur le port {port}")
    # threaded=True explicite : requis pour les connexions SSE persistantes
    # (un thread par client SSE + les requêtes REST en parallèle)
    app.run(host='127.0.0.1', port=port, debug=False, threaded=True)
