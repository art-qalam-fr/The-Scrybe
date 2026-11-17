"""Moteur de transcription cloud — API OpenAI-compatible /audio/transcriptions.

Une seule classe couvre Groq, NVIDIA NIM, OpenAI, Deepgram-compatible ou tout
endpoint custom exposant `POST {base}/audio/transcriptions` (multipart).

ATTENTION — contrat langue different du local : sur les APIs cloud, le
parametre `language` est la langue PARLEE (hint d'entree), PAS la langue de
sortie. La fonctionnalite "parler X -> ecrire Y" repose sur le comportement
local de Whisper (task='transcribe' + options['language'] = sortie). Ici on
n'envoie PAS le hint pour laisser l'auto-detection du provider faire foi —
sinon une langue de sortie differente de la langue parlee degraderait la
transcription.
"""
import os

import requests


class RemoteTranscriptionEngine:
    """Interface identique aux moteurs locaux (cf. engines.py)."""

    def __init__(self, provider, api_key, model, language=None, base_url=None, timeout=120):
        self.provider = provider
        self.api_key = api_key
        self.model_name = model
        self.base_url = (base_url or '').rstrip('/')
        self.timeout = timeout
        self.language = language
        # Meme forme que les moteurs locaux : options['language'] modifiable
        # via set_language — conserve le contrat engines.py cote backend_logic.
        self.options = {'language': language, 'task': 'transcribe'}

    def set_language(self, language):
        self.language = language
        self.options['language'] = language

    def set_model(self, model_name):
        self.model_name = model_name

    def get_model_info(self):
        return {
            'provider': self.provider,
            'model_name': self.model_name,
            'remote': True,
            'language': self.language,
        }

    def transcribe(self, audio_path):
        if not audio_path or not os.path.exists(audio_path):
            return ''
        data = {'model': self.model_name}
        try:
            with open(audio_path, 'rb') as f:
                resp = requests.post(
                    f'{self.base_url}/audio/transcriptions',
                    headers={'Authorization': f'Bearer {self.api_key}'},
                    files={'file': (os.path.basename(audio_path), f)},
                    data=data,
                    timeout=self.timeout,
                )
            resp.raise_for_status()
        except requests.RequestException as e:
            # La cle ne doit JAMAIS apparaitre dans un log : certains providers
            # la re-affichent dans le corps/message d'erreur (401...)
            msg = str(e).replace(self.api_key, '***') if self.api_key else str(e)
            print(f'Erreur moteur cloud {self.provider}: {msg}')
            return ''
        try:
            return (resp.json().get('text') or '').strip()
        except ValueError:
            print(f'Reponse non-JSON du moteur cloud {self.provider}')
            return ''
