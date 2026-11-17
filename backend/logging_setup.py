"""Système de logs persistants pour The Scrybe.

Tout converge vers <racine>/logs/ :
- backend.log         : logs structurés (logging) de tout le backend Python
- backend-console.log : tee brut de stdout/stderr (print(), tqdm, tracebacks)
- frontend.log        : erreurs remontées par les renderers React via /api/log
- electron.log        : écrit par main.cjs (console du process principal)

Rotation : 5 Mo x 3 fichiers par canal. Importé en tout premier par
flask_api.py pour capturer aussi les logs de construction (BackendLogic,
AudioRecorder...). Les scripts dev peuvent appeler init() eux-mêmes.
"""
import io
import logging
import os
import sys
from logging.handlers import RotatingFileHandler

from paths import logs_dir

LOG_DIR = logs_dir()

_initialized = False


class _Tee(io.TextIOBase):
    """Écrit à la fois sur le stream d'origine et dans le fichier console."""

    def __init__(self, stream, fileobj):
        self._stream = stream
        self._file = fileobj

    def write(self, s):
        try:
            self._stream.write(s)
        except Exception:
            pass
        try:
            self._file.write(s)
        except Exception:
            pass
        return len(s)

    def flush(self):
        try:
            self._stream.flush()
        except Exception:
            pass
        try:
            self._file.flush()
        except Exception:
            pass


def _rotating(name):
    handler = RotatingFileHandler(
        os.path.join(LOG_DIR, name),
        maxBytes=5 * 1024 * 1024, backupCount=3, encoding='utf-8'
    )
    handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s %(name)s: %(message)s'))
    return handler


def init():
    """Installe le logging fichier + le tee console. Idempotent."""
    global _initialized
    if _initialized:
        return
    _initialized = True
    os.makedirs(LOG_DIR, exist_ok=True)

    # Logs structurés du backend
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(_rotating('backend.log'))

    # Tee brut de stdout/stderr — capture print(), tqdm, tracebacks
    console = logging.getLogger('console')
    console.propagate = False
    console.setLevel(logging.INFO)
    console.addHandler(_rotating('backend-console.log'))

    class _LoggerTee(_Tee):
        def write(self, s):
            try:
                self._stream.write(s)
            except Exception:
                pass
            for line in s.splitlines():
                line = line.rstrip()
                if line:
                    console.info(line)
            return len(s)

        def flush(self):
            try:
                self._stream.flush()
            except Exception:
                pass

    sys.stdout = _LoggerTee(sys.stdout, None)
    sys.stderr = _LoggerTee(sys.stderr, None)

    # Logger dédié aux erreurs remontées par les renderers via /api/log
    frontend = logging.getLogger('frontend')
    frontend.propagate = False
    frontend.setLevel(logging.INFO)
    frontend.addHandler(_rotating('frontend.log'))

    def _excepthook(exc_type, exc_value, exc_tb):
        logging.getLogger('crash').critical(
            'Exception non interceptée', exc_info=(exc_type, exc_value, exc_tb))
        sys.__excepthook__(exc_type, exc_value, exc_tb)

    sys.excepthook = _excepthook

    logging.getLogger(__name__).info('Logging initialisé -> %s', LOG_DIR)


def frontend_logger():
    """Logger qui écrit dans logs/frontend.log (utilisé par /api/log)."""
    return logging.getLogger('frontend')
