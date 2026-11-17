"""Registre des moteurs de transcription.

Chaque moteur expose la même interface minimale :
- ``transcribe(audio_path) -> str``
- attribut ``.language`` modifiable
- ``.options['language']`` modifiable

Pour ajouter un moteur distant (API payante, service cloud...), créer une
classe compatible dans un module dédié et l'enregistrer dans ENGINES.
La disponibilité est testée via importlib.util.find_spec (pas d'import lourd
au démarrage — torch/whisper ne sont chargés qu'à l'instanciation).

GPU : ces variables DOIVENT être posées avant l'import de ctranslate2
(faster-whisper). CUDA_DEVICE_ORDER=PCI_BUS_ID aligne la numérotation CUDA
sur celle de nvidia-smi (ordre bus PCI) — sans elle, CUDA trie par vitesse
et l'index 0 peut désigner la mauvaise carte. SCRYBE_GPU_INDEX (défaut "0",
= GTX 1050 3 Go sur la machine de dev) choisit la carte physique ; la carte
6 Go reste réservée à Ollama. "cpu"/"none" force le CPU.
"""
import importlib.util
import os
import re

def _load_env_file():
    """Charge <projet>/.env dans os.environ (sans ecraser l'env reel).
    Format KEY=value, # commentaire. Suffit pour les cles API cloud —
    evite d'ajouter python-dotenv pour un usage unique."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    try:
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, _, val = line.partition('=')
                key, val = key.strip(), val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
    except OSError:
        pass


_load_env_file()

_raw_gpu = os.environ.get(
    'SCRYBE_GPU_INDEX', os.environ.get('CUDA_VISIBLE_DEVICES', '0')
).strip().lower()
if _raw_gpu in ('cpu', 'none', '-1', '', 'off', 'false', 'disable', 'disabled'):
    os.environ['CUDA_DEVICE_ORDER'] = 'PCI_BUS_ID'
    os.environ['CUDA_VISIBLE_DEVICES'] = ''
elif re.fullmatch(r'\d+(,\d+)*', _raw_gpu):
    os.environ['CUDA_DEVICE_ORDER'] = 'PCI_BUS_ID'
    os.environ['CUDA_VISIBLE_DEVICES'] = _raw_gpu
else:
    # Valeur invalide : ne pas la propager à CUDA (comportement indéfini)
    print(f"SCRYBE_GPU_INDEX='{_raw_gpu}' invalide, GPU désactivé "
          "(attendu: index entier, ex '0', ou 'cpu')")
    os.environ['CUDA_VISIBLE_DEVICES'] = ''

ENGINES = {
    'faster_whisper': {
        'label': 'Faster Whisper (local, rapide)',
        'module': 'faster_whisper',
    },
    'whisper': {
        'label': 'Whisper vanilla (local, CPU uniquement)',
        'module': 'whisper',
    },
}


# Moteurs cloud : endpoint OpenAI-compatible POST {base_url}/audio/transcriptions.
# La clé est résolue par key_resolver(provider) -> str|None, défini par
# backend_logic (d'abord env var `env_key`, puis réglage DB engine_key_<id>).
REMOTE_PROVIDERS = {
    'groq': {
        'label': 'Groq Cloud — Whisper (gratuit : ~2000 dictées/j)',
        'base_url': 'https://api.groq.com/openai/v1',
        'env_key': 'GROQ_API_KEY',
        'default_model': 'whisper-large-v3-turbo',
        'models': {
            'whisper-large-v3-turbo': 'Whisper Large v3 Turbo (rapide)',
            'whisper-large-v3': 'Whisper Large v3 (précis)',
        },
        'free': True,
    },
    'nvidia': {
        'label': 'NVIDIA NIM Cloud (crédits trial)',
        'base_url': 'https://integrate.api.nvidia.com/v1',
        'env_key': 'NVIDIA_API_KEY',
        'default_model': 'openai/whisper-large-v3',
        'models': {
            'openai/whisper-large-v3': 'Whisper Large v3',
            'nvidia/parakeet-ctc-1.1b-asr': 'Parakeet CTC 1.1B (EN)',
        },
    },
    'openai': {
        'label': 'OpenAI Cloud (payant)',
        'base_url': 'https://api.openai.com/v1',
        'env_key': 'OPENAI_API_KEY',
        'default_model': 'whisper-1',
        'models': {
            'whisper-1': 'Whisper v2',
            'gpt-4o-transcribe': 'GPT-4o Transcribe',
            'gpt-4o-mini-transcribe': 'GPT-4o mini Transcribe',
        },
    },
    'custom': {
        'label': 'Custom (endpoint OpenAI-compatible)',
        'base_url': '',  # saisi par l'utilisateur dans les réglages
        'env_key': 'CUSTOM_STT_API_KEY',
        'default_model': '',
        'models': {},
        'custom': True,
    },
}


def is_remote(name):
    return name in REMOTE_PROVIDERS


def _resolve_key(name, key_resolver):
    if key_resolver:
        key = key_resolver(name)
        if key:
            return key
    env_var = REMOTE_PROVIDERS[name]['env_key']
    return os.environ.get(env_var) or None


def is_available(name, key_resolver=None):
    """Vrai si le moteur est utilisable : package installé (local) ou
    clé configurée (cloud)."""
    if is_remote(name):
        info = REMOTE_PROVIDERS[name]
        if info.get('custom'):
            # Le provider custom exige clé + base_url + modèle
            return bool(_resolve_key(name, key_resolver))
        return bool(_resolve_key(name, key_resolver))
    info = ENGINES.get(name)
    if not info:
        return False
    return importlib.util.find_spec(info['module']) is not None


def available_engines(key_resolver=None):
    """Liste les moteurs : [{'id', 'label', 'remote', 'configured', 'models'}]."""
    out = [
        {'id': name, 'label': info['label'], 'remote': False, 'configured': True}
        for name, info in ENGINES.items()
        if is_available(name)
    ]
    for name, info in REMOTE_PROVIDERS.items():
        configured = is_available(name, key_resolver)
        entry = {
            'id': name,
            'label': info['label'],
            'remote': True,
            'configured': configured,
            'requires_key': info['env_key'],
            'models': info['models'],
            'default_model': info['default_model'],
            'custom': bool(info.get('custom')),
        }
        if info.get('free'):
            entry['free'] = True
        out.append(entry)
    return out


def default_engine(key_resolver=None):
    """Moteur par défaut : faster-whisper si présent, sinon whisper vanilla."""
    for name in ('faster_whisper', 'whisper'):
        if is_available(name):
            return name
    return None


def create_engine(name, model_name, language, key_resolver=None):
    """Instancie un moteur. Les imports lourds (torch, whisper) sont faits ici."""
    if is_remote(name):
        info = REMOTE_PROVIDERS[name]
        key = _resolve_key(name, key_resolver)
        if not key:
            raise ValueError(f"Clé API manquante pour le moteur cloud '{name}' ({info['env_key']})")
        base_url = info['base_url']
        saved_model = key_resolver(f'{name}_model') if key_resolver else None
        model = model_name if model_name in info['models'] else saved_model or info['default_model']
        if info.get('custom') and key_resolver:
            base_url = key_resolver(f'{name}_base_url') or base_url
            model = key_resolver(f'{name}_model') or model or model_name
        if not base_url or not model:
            raise ValueError(f"Provider cloud '{name}' incomplet : base_url et modèle requis")
        from remote_engine import RemoteTranscriptionEngine
        return RemoteTranscriptionEngine(
            provider=name, api_key=key, model=model,
            language=language, base_url=base_url,
        )
    if name == 'faster_whisper':
        from speech_recognizer_optimized import SpeechRecognizerOptimized
        return SpeechRecognizerOptimized(model_name=model_name, language=language)
    if name == 'whisper':
        from speech_recognizer import SpeechRecognizer
        return SpeechRecognizer(model_name=model_name, language=language)
    raise ValueError(f"Moteur de transcription inconnu : {name}")
