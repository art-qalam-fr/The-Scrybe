import os
import wave
import threading
import tempfile
import logging
import time

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AudioRecorder:
    def __init__(self, sample_rate=16000, channels=1, chunk_size=1024):
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = chunk_size
        # Garde-fou si l'événement de relâchement est perdu : durée max
        # d'enregistrement (0 = illimité). Défaut 10 min.
        self.max_duration = float(os.environ.get('SCRYBE_MAX_REC_SECONDS', '600'))
        # Callback optionnel invoqué quand la durée max est atteinte
        # (BackendLogic.stop_recording — appelé depuis un thread dédié)
        self.on_auto_stop = None
        
        self.stream = None
        self.frames = []
        self.recording = False
        
        logger.info(f"AudioRecorder initialisé (sounddevice) - Taux: {sample_rate}Hz, Canaux: {channels}")
        
    def start_recording(self):
        logger.info("Démarrage de l'enregistrement audio...")
        self.frames = []
        self.recording = True
        self._error = None
        self._stream_ready = threading.Event()

        def record():
            # sounddevice importé ici : ~6 s à froid (init PortAudio), différer
            # permet au backend de démarrer avant le premier enregistrement
            import sounddevice as sd
            try:
                with sd.InputStream(
                    samplerate=self.sample_rate,
                    channels=self.channels,
                    dtype='int16',
                    blocksize=self.chunk_size
                ) as stream:
                    self._stream_ready.set()
                    started = time.time()
                    hit_max = False
                    while self.recording:
                        if self.max_duration > 0 and time.time() - started > self.max_duration:
                            logger.warning(f"Durée max d'enregistrement atteinte "
                                           f"({self.max_duration:.0f}s) — arrêt de sécurité")
                            hit_max = True
                            break
                        try:
                            data, _ = stream.read(self.chunk_size)
                            self.frames.append(data)
                        except Exception as e:
                            logger.error(f"Erreur lecture audio: {e}")
                            break
                    if hit_max and self.on_auto_stop:
                        # Ne pas appeler depuis ce thread : stop_recording fait
                        # un join() sur record_thread -> délègue à un thread dédié
                        threading.Thread(target=self.on_auto_stop, daemon=True).start()
            except Exception as e:
                self._error = e
                logger.error(f"Erreur enregistrement: {e}")
            finally:
                # Garantit que l'état reflète la réalité même en cas d'échec du stream
                self.recording = False
                self._stream_ready.set()

        self.record_thread = threading.Thread(target=record, daemon=True)
        self.record_thread.start()

        # Attendre l'ouverture du stream : une erreur immédiate (micro absent,
        # permissions, pilote) est remontée à l'appelant au lieu d'être silencieuse
        if not self._stream_ready.wait(timeout=3):
            # Le thread peut encore être en train d'ouvrir le stream : on
            # désarme la boucle d'enregistrement et on remonte l'échec
            self.recording = False
            logger.warning("Timeout d'ouverture du stream audio (3s)")
            raise RuntimeError("Timeout d'ouverture du stream audio (3s)")
        if self._error is not None:
            self.recording = False
            raise self._error
        logger.info("Thread d'enregistrement démarré")
        
    def stop_recording(self):
        self.recording = False
        
        if hasattr(self, 'record_thread'):
            self.record_thread.join(timeout=2)
            
        if self.frames:
            # numpy importé à la demande : lourd au premier chargement à froid
            import numpy as np
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            audio_data = np.concatenate(self.frames, axis=0)
            with wave.open(temp_file.name, 'wb') as wf:
                wf.setnchannels(self.channels)
                wf.setsampwidth(2)
                wf.setframerate(self.sample_rate)
                wf.writeframes(audio_data.tobytes())
            return temp_file.name
        return None