# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller — backend Flask gele en scrybe-backend.exe (onedir).

Build : .venv/Scripts/python.exe -m PyInstaller scripts/backend.spec --noconfirm
Sortie : dist-backend/scrybe-backend/ (exe + _internal)
Les modeles Whisper NE sont PAS bundles — telecharges au premier usage (HF cache).
"""
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.abspath(os.path.join(os.path.dirname(SPEC), '..'))
BACKEND = os.path.join(ROOT, 'backend')

datas, binaries, hiddenimports = [], [], []

# Packages avec assets natifs/data obligatoires
for pkg in ('faster_whisper', 'ctranslate2', 'whisper', 'sounddevice',
            'tokenizers', 'huggingface_hub', 'numba'):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# Torch : hook PyInstaller suffit pour CPU
hiddenimports += collect_submodules('torch')
hiddenimports += collect_submodules('flask')

# Modules locaux importes paresseusement (engines.create_engine)
hiddenimports += [
    'speech_recognizer', 'speech_recognizer_optimized', 'remote_engine',
    'model_loader', 'engines', 'paths',
]

a = Analysis(
    [os.path.join(BACKEND, 'flask_api.py')],
    pathex=[BACKEND],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=['torchvision', 'tensorboard', 'IPython', 'matplotlib',
              'notebook', 'pytest', 'PIL', 'tkinter'],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='scrybe-backend',
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='scrybe-backend',
)
