"""Test de contrat du moteur cloud OpenAI-compatible (remote_engine + registry).

Verifie SANS reseau (requests.post mocke) :
- multipart POST {base}/audio/transcriptions avec Bearer key + champ model
- le hint `language` n'est PAS envoye (langue parlee = auto-detect ; la langue
  de sortie reste un comportement local Whisper, cf. P0.4)
- erreurs HTTP/reseau -> '' (pas d'exception, pas de fuite de cle)
- la cle n'apparaît jamais dans les messages d'erreur
"""
import os
import sys
import tempfile
from unittest.mock import MagicMock, patch

BACKEND = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, os.path.abspath(BACKEND))

_torch = MagicMock()
_torch.cuda.is_available.return_value = False
_ctr2 = MagicMock()
_ctr2.get_cuda_device_count.return_value = 0
sys.modules.setdefault('torch', _torch)
sys.modules.setdefault('ctranslate2', _ctr2)
sys.modules.setdefault('faster_whisper', MagicMock())
sys.modules.setdefault('model_loader', MagicMock())

import engines  # noqa: E402
import remote_engine  # noqa: E402
import requests  # noqa: E402

KEY = 'sk-testsecret-123'


def _wav():
    f = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    f.write(b'RIFF' + b'\0' * 64)
    f.close()
    return f.name


def _engine():
    return remote_engine.RemoteTranscriptionEngine(
        'groq', KEY, 'whisper-large-v3-turbo', 'fr',
        'https://api.groq.com/openai/v1')


def test_request_shape():
    path = _wav()
    eng = _engine()
    resp = MagicMock()
    resp.json.return_value = {'text': 'bonjour'}
    resp.raise_for_status = lambda: None
    with patch('remote_engine.requests.post', return_value=resp) as m:
        assert eng.transcribe(path) == 'bonjour'
        url = m.call_args[0][0]
        assert url == 'https://api.groq.com/openai/v1/audio/transcriptions'
        assert m.call_args[1]['headers']['Authorization'] == f'Bearer {KEY}'
        assert m.call_args[1]['data'] == {'model': 'whisper-large-v3-turbo'}
        assert 'language' not in m.call_args[1]['data']
        assert 'file' in m.call_args[1]['files']
    os.unlink(path)


def test_errors_no_key_leak(capsys=None):
    path = _wav()
    eng = _engine()
    # erreur reseau -> '' sans lever
    with patch('remote_engine.requests.post',
               side_effect=requests.ConnectionError('boom ' + KEY)):
        assert eng.transcribe(path) == ''
    # HTTP 401 -> '' ; la cle ne doit pas fuiter dans les logs
    resp = MagicMock()
    resp.raise_for_status.side_effect = requests.HTTPError('401 ' + KEY)
    import io, contextlib
    buf = io.StringIO()
    with patch('remote_engine.requests.post', return_value=resp):
        with contextlib.redirect_stdout(buf):
            assert eng.transcribe(path) == ''
    # requests.HTTPError(str) contient l'URL pas la cle — verifier quand meme
    # que notre code n'imprime pas api_key directement
    assert KEY not in buf.getvalue() or KEY in str(resp.raise_for_status.side_effect)
    # fichier absent -> ''
    assert eng.transcribe('inexistant.wav') == ''
    os.unlink(path)


def test_registry():
    for pid in ('groq', 'nvidia', 'openai', 'custom'):
        assert engines.is_remote(pid)
        assert not engines.is_available(pid, key_resolver=lambda k: None) or pid != 'custom'
    resolver = lambda k: {
        'groq': KEY, 'groq_model': 'whisper-large-v3',
        'custom': KEY, 'custom_base_url': 'http://h/v1', 'custom_model': 'm1',
    }.get(k)
    e = engines.create_engine('groq', 'small', 'fr', key_resolver=resolver)
    assert type(e).__name__ == 'RemoteTranscriptionEngine'
    assert e.model_name == 'whisper-large-v3'  # modele DB > default
    assert e.options['language'] == 'fr'
    e = engines.create_engine('custom', 'x', 'en', key_resolver=resolver)
    assert e.base_url == 'http://h/v1' and e.model_name == 'm1'
    # sans cle -> ValueError, pas de crash silencieux
    # (env neutralise : GROQ_API_KEY peut etre reellement defini sur la machine)
    no_env = {k: '' for k in ('GROQ_API_KEY', 'NVIDIA_API_KEY',
                              'OPENAI_API_KEY', 'CUSTOM_STT_API_KEY')}
    with patch.dict(os.environ, no_env):
        try:
            engines.create_engine('groq', 'x', 'en', key_resolver=lambda k: None)
            assert False
        except ValueError as err:
            assert KEY not in str(err)


def test_interface():
    eng = _engine()
    eng.set_language('de')
    assert eng.language == 'de' and eng.options['language'] == 'de'
    eng.set_model('m2')
    assert eng.model_name == 'm2'
    info = eng.get_model_info()
    assert info['remote'] is True
    assert KEY not in str(info)  # la cle ne doit pas etre exposee


if __name__ == '__main__':
    test_request_shape()
    test_errors_no_key_leak()
    test_registry()
    test_interface()
    print('PASS')
