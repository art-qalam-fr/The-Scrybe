"""
Speech recognizer using faster-whisper for 4x faster transcription
"""
import os
import engines  # pose CUDA_DEVICE_ORDER/CUDA_VISIBLE_DEVICES avant ctranslate2
import ctranslate2
from faster_whisper import WhisperModel

# Borne le timeout des checks réseau HF (défaut = 10s par requête, plusieurs retries)
os.environ.setdefault('HF_HUB_ETAG_TIMEOUT', '10')


def _is_model_cached(model_name):
    """True si le modèle faster-whisper est déjà dans le cache HF local.
    Évite les requêtes réseau de vérification de révision à chaque chargement
    (local_files_only=True quand le cache existe)."""
    hub = os.environ.get('HF_HOME', os.path.join(os.path.expanduser('~'), '.cache', 'huggingface'))
    safe = model_name.replace('/', '--')
    if not safe.startswith('models--'):
        safe = f'models--Systran--faster-whisper-{safe}'
    return os.path.isdir(os.path.join(hub, 'hub', safe))


_CT_CACHE = os.path.join(
    os.environ.get('HF_HOME', os.path.join(os.path.expanduser('~'), '.cache')),
    'scrybe_compute_type.json'
)


def _load_compute_type_hint():
    """Dernière combinaison device/compute_type qui a réussi.

    Sur Pascal (GTX 10xx), la tentative cuda/float16 échoue après ~2 min
    (poids chargés puis rejetés). Rejouer la combinaison gagnante en premier
    supprime ce coût à chaque démarrage. Surcharge possible via
    SCRYBE_COMPUTE_TYPE (ex. 'int8', 'float16')."""
    forced = os.environ.get('SCRYBE_COMPUTE_TYPE')
    if forced:
        return forced.strip()
    try:
        import json
        with open(_CT_CACHE, 'r', encoding='utf-8') as f:
            return json.load(f).get('compute_type')
    except Exception:
        return None


def _save_compute_type_hint(device, compute_type):
    if device != 'cuda':
        return
    try:
        import json
        os.makedirs(os.path.dirname(_CT_CACHE), exist_ok=True)
        with open(_CT_CACHE, 'w', encoding='utf-8') as f:
            json.dump({'device': device, 'compute_type': compute_type}, f)
    except Exception:
        pass

class SpeechRecognizerOptimized:
    def __init__(self, model_name="small", language="fr"):
        self.model_name = model_name
        self.language = language
        self.model = None
        # ctranslate2 sonde le GPU réel ; torch est compilé +cpu ici et
        # torch.cuda.is_available() renverrait toujours False.
        # Le choix de la carte est verrouillé par engines.py
        # (CUDA_DEVICE_ORDER=PCI_BUS_ID + CUDA_VISIBLE_DEVICES).
        self.device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
        # Cascade de compute_type : float16 (Turing+) -> int8 (Pascal DP4A) -> CPU.
        self.compute_type = None
        
        # Options pour Whisper (plus simples pour faster-whisper)
        self.options = {
            # "language" = langue de SORTIE : parler X -> ecrire Y.
            # Ne jamais passer task a "translate" (anglais uniquement).
            "language": language,
            "task": "transcribe",
            "beam_size": 1,
            "temperature": 0.0
        }
        
        # Chargement synchrone : la paresse est gérée au niveau BackendLogic
        # (_get_recognizer ne crée cette instance qu'à la première transcription,
        # sous verrou + statut "Chargement du modèle..."). Si le modèle restait
        # déchargé ici, transcribe() chargerait sans statut ni verrou.
        self._load_model()
    
    def _load_model(self):
        """Charge le modèle Whisper optimisé"""
        if self.model is None:
            print(f"Chargement du modèle faster-whisper {self.model_name} sur {self.device}...")
            # Cascade de compute_type : float16 (Turing+) -> int8 (Pascal DP4A) -> CPU.
            # La combinaison qui a déjà marché est rejouée en premier : sur
            # Pascal, cuda/float16 échoue APRÈS ~2 min de chargement des poids.
            attempts = [("cuda", "float16"), ("cuda", "int8")] if self.device == "cuda" else []
            hint = _load_compute_type_hint()
            if self.device == "cuda" and hint in ("float16", "int8_float16", "int8"):
                attempts = [("cuda", hint)] + [a for a in attempts if a[1] != hint]
            attempts.append(("cpu", "int8"))
            # Modèle déjà en cache -> pas de check réseau HF (sinon latence +
            # risque de blocage si huggingface.co est injoignable)
            local_only = _is_model_cached(self.model_name)
            last_err = None
            for device, ctype in attempts:
                try:
                    self.model = WhisperModel(
                        self.model_name, device=device,
                        device_index=0, compute_type=ctype,
                        local_files_only=local_only
                    )
                    self.device, self.compute_type = device, ctype
                    _save_compute_type_hint(device, ctype)
                    break
                except Exception as e:
                    print(f"WhisperModel {device}/{ctype} impossible: {e}")
                    last_err = e
            if self.model is None:
                raise last_err
            print(f"Modèle {self.model_name} chargé sur {self.device} ({self.compute_type})")
    
    def transcribe(self, audio_path):
        """
        Transcrit un fichier audio avec faster-whisper
        
        Args:
            audio_path (str): Chemin vers le fichier audio
            
        Returns:
            str: Texte transcrit
        """
        try:
            # S'assurer que le modèle est chargé
            self._load_model()
            
            # Transcription avec faster-whisper
            segments, info = self.model.transcribe(
                audio_path,
                **self.options
            )
            
            # Combiner tous les segments
            text = " ".join(segment.text for segment in segments)
            
            return text.strip()
            
        except Exception as e:
            print(f"Erreur lors de la transcription: {e}")
            return ""
    
    def set_language(self, language):
        """Change la langue de transcription"""
        self.language = language
        self.options["language"] = language
    
    def set_model(self, model_name):
        """Change le modèle Whisper"""
        if model_name != self.model_name:
            self.model_name = model_name
            self.model = None  # Forcer le rechargement
            self.compute_type = None
            # Réévaluer le device : un repli CPU temporaire ne doit pas
            # verrouiller le moteur sur CPU pour les modèles suivants
            self.device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
    
    def get_available_languages(self):
        """Retourne la liste des langues supportées"""
        # faster-whisper supporte les mêmes langues que Whisper
        return {
            'fr': 'Français',
            'en': 'Anglais', 
            'es': 'Espagnol',
            'de': 'Allemand',
            'it': 'Italien',
            'ja': 'Japonais',
            'zh': 'Chinois',
            'pt': 'Portugais',
            'ru': 'Russe',
            'ar': 'Arabe',
            'hi': 'Hindi',
            'ko': 'Coréen',
            'nl': 'Néerlandais',
            'pl': 'Polonais',
            'tr': 'Turc',
            'sv': 'Suédois',
            'da': 'Danois',
            'no': 'Norvégien',
            'fi': 'Finnois'
        }
    
    def get_model_info(self):
        """Retourne des informations sur le modèle"""
        return {
            'model_name': self.model_name,
            'device': self.device,
            'compute_type': self.compute_type,
            'language': self.language,
            'is_loaded': self.model is not None
        }

# Pour une migration facile, gardons l'interface compatible
if __name__ == "__main__":
    # Test rapide
    recognizer = SpeechRecognizerOptimized()
    print("Modèles disponibles:", list(recognizer.get_available_languages().keys()))
    print("Info modèle:", recognizer.get_model_info())
