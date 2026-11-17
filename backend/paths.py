"""Resolution des chemins runtime.

Dev  : tout vit sous <racine>/ (data/, logs/).
Gele (PyInstaller) : l'app est installee dans Program Files -> pas
d'ecriture possible. La DB, les logs et les settings migrent vers
%LOCALAPPDATA%/TheScrybe/.
"""
import os
import sys

APP_DIR_NAME = 'TheScrybe'


def is_frozen():
    return getattr(sys, 'frozen', False)


def app_base_dir():
    """Racine ecrivable : %LOCALAPPDATA%/TheScrybe gele, sinon racine projet."""
    if is_frozen():
        base = os.path.join(
            os.environ.get('LOCALAPPDATA', os.path.expanduser('~')),
            APP_DIR_NAME,
        )
        os.makedirs(base, exist_ok=True)
        return base
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def data_dir():
    d = os.path.join(app_base_dir(), 'data')
    os.makedirs(d, exist_ok=True)
    return d


def logs_dir():
    d = os.path.join(app_base_dir(), 'logs')
    os.makedirs(d, exist_ok=True)
    return d
