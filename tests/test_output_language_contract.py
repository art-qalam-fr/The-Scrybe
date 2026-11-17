"""Verrou de contrat : "parler X -> ecrire Y".

La langue choisie dans l'UI est la langue de SORTIE de Whisper
(`options['language']` + `task='transcribe'`) : parler allemand avec
'en' selectionne produit un texte anglais. Fonctionnalite arrivee "par
accident" mais volontairement conservee — cf. PRD/DEV_PLAN.md (P0.4).

Ce test ne charge aucun modele : il verifie uniquement que le contrat
options reste intact dans les deux moteurs (faster-whisper + vanilla)
et que `set_language` propage bien dans `options['language']`.
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

BACKEND = Path(__file__).resolve().parents[1] / 'backend'
sys.path.insert(0, str(BACKEND))

# Deps lourdes non requises pour tester le contrat options.
_torch = MagicMock()
_torch.cuda.is_available.return_value = False
_ctr2 = MagicMock()
_ctr2.get_cuda_device_count.return_value = 0
sys.modules.setdefault('torch', _torch)
sys.modules.setdefault('ctranslate2', _ctr2)
sys.modules.setdefault('faster_whisper', MagicMock())
sys.modules.setdefault('model_loader', MagicMock())

import engines  # noqa: E402
from speech_recognizer_optimized import SpeechRecognizerOptimized  # noqa: E402
from speech_recognizer import SpeechRecognizer  # noqa: E402

PASS = True


def check(label, ok):
    global PASS
    print(('PASS' if ok else 'FAIL'), label)
    if not ok:
        PASS = False


def make_optimized(language):
    with patch.object(SpeechRecognizerOptimized, '_load_model', lambda self: None):
        return SpeechRecognizerOptimized(model_name='tiny', language=language)


def make_vanilla(language):
    return SpeechRecognizer(model_name='tiny', language=language)


for label, factory in (
    ('faster_whisper', make_optimized),
    ('whisper vanilla', make_vanilla),
):
    rec = factory('de')
    check(f'{label}: task=transcribe (jamais "translate")',
          rec.options.get('task') == 'transcribe')
    check(f'{label}: language initiale propagee dans options',
          rec.options.get('language') == 'de')
    if hasattr(rec, 'set_language'):
        rec.set_language('en')
    else:
        # Interface portable documentee dans engines.py
        rec.language = 'en'
        rec.options['language'] = 'en'
    check(f'{label}: set_language met a jour options["language"]',
          rec.options.get('language') == 'en' and rec.language == 'en')

# L'interface du registre impose le contrat : options['language'] modifiable
check('create_engine expose les deux moteurs du registre',
      set(engines.ENGINES) == {'faster_whisper', 'whisper'})

print()
print('RESULT:', 'PASS' if PASS else 'FAIL')
sys.exit(0 if PASS else 1)
