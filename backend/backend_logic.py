import os
import json
import threading
import time
from datetime import datetime
from audio_recorder import AudioRecorder
import engines
from database_manager import DatabaseManager
from text_injector import TextInjector
from hotkey_manager import HotkeyManager
import traceback


class BackendLogic:
    def __init__(self):
        self.is_recording = False
        self.is_loading_model = False
        self.is_transcribing = False
        self.current_status = "Prêt"
        self.current_language = "fr"
        self.model_size = "small"
        self.selected_device = None
        self.editing_shortcut = False  # Requis par HotkeyManager

        # Thème et Apparence avancée
        self.appearance = {
            "themeVariant": "glass",
            "bgColor": "#1a5276",
            "bgOpacity": 70,
            "blur": 10,
            "borderRadius": 12,
            "borderColor": "#2e86c1",
            "borderStyle": "thin",
        }

        # Initialiser les composants
        self.db_manager = DatabaseManager()

        # Charger l'apparence depuis la base de données ou utiliser les défauts
        saved_appearance = self.db_manager.get_setting("appearance")
        if saved_appearance:
            try:
                import json

                self.appearance = json.loads(saved_appearance.replace("'", '"'))
            except:
                self.appearance = {
                    "themeVariant": "glass",
                    "bgColor": "#1a5276",
                    "bgOpacity": 70,
                    "blur": 10,
                    "borderRadius": 12,
                    "borderColor": "#2e86c1",
                    "borderStyle": "thin",
                }
        else:
            self.appearance = {
                "themeVariant": "glass",
                "bgColor": "#1a5276",
                "bgOpacity": 70,
                "blur": 10,
                "borderRadius": 12,
                "borderColor": "#2e86c1",
                "borderStyle": "thin",
            }

        # Apparence du WIDGET : indépendante du dashboard. Par défaut on
        # repart du thème du dashboard, puis l'utilisateur peut diverger.
        default_widget_appearance = dict(self.appearance)
        default_widget_appearance["iconTemplate"] = "scrybe"
        saved_widget = self.db_manager.get_setting("widget_appearance")
        if saved_widget:
            try:
                self.widget_appearance = {
                    **default_widget_appearance,
                    **json.loads(saved_widget.replace("'", '"')),
                }
            except Exception:
                self.widget_appearance = default_widget_appearance
        else:
            self.widget_appearance = default_widget_appearance

        self.audio_recorder = AudioRecorder()
        # Si la durée max est atteinte (relâchement hotkey perdu), auto-stop
        self.audio_recorder.on_auto_stop = self.stop_recording

        # Moteur de transcription : chargement PARESSEUX — le backend démarre
        # vite, le modèle Whisper n'est chargé qu'à la première transcription.
        # Le choix du moteur est persisté en DB et modifiable via l'API.
        saved_engine = self.db_manager.get_setting("engine")
        self.engine_name = (
            saved_engine
            if saved_engine and engines.is_available(saved_engine, self.engine_setting)
            else engines.default_engine()
        )
        self.speech_recognizer = None
        self._recognizer_lock = threading.Lock()
        # Verrou atomique check-and-set pour set_engine / set_quality (deux POST
        # simultanés ne doivent pas démarrer deux rechargements lourds)
        self._config_lock = threading.Lock()
        # Sérialise l'inférence : deux transcriptions parallèles satureraient le CPU
        self._transcribe_lock = threading.Lock()

        # Bus d'événements SSE : flask_api enregistre un publisher, le backend
        # pousse les changements d'état au lieu d'être interrogé en polling
        self._event_publisher = None

        self.text_injector = TextInjector()

        # Raccourcis par défaut
        self.shortcuts = {
            "push_to_talk": ["Ctrl", "Alt"],
            "push_to_block": ["Ctrl", "Shift"],
        }
        self.hotkey_manager = HotkeyManager(self)
        self.hotkey_manager.start()

        self.transcription_thread = None
        # Pré-chargement du modèle en tâche de fond (lazy + prêt pour la 1re dictée)
        self.warmup_engine()

    # --- Événements (SSE) ---------------------------------------------------

    def set_event_publisher(self, fn):
        """Enregistre la fonction de publication SSE (appelée par flask_api)."""
        self._event_publisher = fn

    def _emit(self, event_type):
        if self._event_publisher:
            try:
                self._event_publisher(
                    event_type, self.get_status() if event_type == "status" else None
                )
            except Exception:
                pass

    def _set_status(self, status):
        """Tout changement de statut passe ici -> poussé en SSE immédiatement."""
        self.current_status = status
        self._emit("status")

    # --- Moteur de transcription (lazy) --------------------------------------

    def engine_setting(self, key):
        """Résolution des réglages moteur cloud (key_resolver pour engines.py).
        'groq' → engine_key_groq ; 'groq_model' → engine_groq_model ;
        'custom_base_url' → engine_custom_base_url."""
        suffix = (
            key
            if key.startswith("custom_") or key.endswith(("_model", "_base_url"))
            else f"key_{key}"
        )
        return self.db_manager.get_setting(f"engine_{suffix}")

    def _get_recognizer(self, post_load_status="🔄 Transcription..."):
        """Retourne le recognizer, en le créant à la demande (lazy loading)."""
        if self.speech_recognizer is None:
            with self._recognizer_lock:
                if self.speech_recognizer is None:
                    if not self.engine_name:
                        raise RuntimeError("Aucun moteur de transcription installé")
                    self.is_loading_model = True
                    self._set_status(f"Chargement du modèle {self.model_size}...")
                    try:
                        self.speech_recognizer = engines.create_engine(
                            self.engine_name, self.model_size, self.current_language,
                            key_resolver=self.engine_setting,
                        )
                        # Appelé depuis process() : la transcription continue —
                        # ne PAS afficher "Prêt" pendant qu'elle tourne
                        if post_load_status:
                            self._set_status(post_load_status)
                    finally:
                        self.is_loading_model = False
        return self.speech_recognizer

    def warmup_engine(self, delay=8):
        """Pré-charge le moteur en tâche de fond juste après le boot : conserve
        le démarrage instantané tout en supprimant la latence de la 1re dictée
        (init CUDA + ~800 Mo de VRAM + éventuels checks réseau)."""

        def _warm():
            time.sleep(delay)
            try:
                if self.speech_recognizer is None and not self.is_recording:
                    self._get_recognizer(post_load_status=None)
                    if not self.is_recording and not self.is_transcribing:
                        self._set_status("Prêt")
            except Exception as e:
                # L'échec du warmup n'est pas fatal : la 1re dictée chargera
                print(f"Warmup moteur échoué (chargement différé à la 1re dictée): {e}")

        threading.Thread(target=_warm, daemon=True).start()

    def set_engine(self, name):
        """Change de moteur de transcription (persisté en DB après succès)."""
        if not engines.is_available(name, self.engine_setting) or self.is_loading_model:
            return False
        if self.speech_recognizer is None:
            # Lazy : rien à recharger, la prochaine transcription utilisera ce moteur
            self.engine_name = name
            self.db_manager.set_setting("engine", name)
            return True

        # Check-and-set atomique : pas deux rechargements concurrents
        with self._config_lock:
            if self.is_loading_model:
                return False
            self.is_loading_model = True

        old_engine = self.engine_name
        self._set_status(f"Chargement du moteur {name}...")

        def reload():
            try:
                recognizer = engines.create_engine(
                    name, self.model_size, self.current_language,
                    key_resolver=self.engine_setting,
                )
                self.speech_recognizer = recognizer
                self.engine_name = name
                self.db_manager.set_setting("engine", name)
                if not self.is_recording and not self.is_transcribing:
                    self._set_status("Prêt")
            except Exception as e:
                self.engine_name = old_engine  # rollback : la DB reste cohérente
                self._set_status(f"Erreur moteur: {str(e)}")
            finally:
                self.is_loading_model = False

        threading.Thread(target=reload, daemon=True).start()
        return True

    def set_engine_config(self, provider, key=None, base_url=None, model=None):
        """Persiste la config d'un moteur cloud : clé API et, pour 'custom',
        base_url + modèle. La clé part en DB (jamais commitée), jamais renvoyée
        au frontend — get_status n'expose que 'configured'."""
        if not engines.is_remote(provider):
            return False
        if key is not None:
            self.db_manager.set_setting(f"engine_key_{provider}", key.strip())
        if provider == "custom" and base_url is not None:
            self.db_manager.set_setting("engine_custom_base_url", base_url.strip())
        if model is not None:
            self.db_manager.set_setting(f"engine_{provider}_model", model.strip())
        # Si le moteur actif est ce provider, on force sa recréation pour
        # prendre la nouvelle clé au prochain appel
        if self.engine_name == provider:
            self.speech_recognizer = None
        self._emit("status")
        return True

    def load_shortcuts(self):
        # Pourrait charger depuis la DB plus tard
        return self.shortcuts

    def save_shortcuts(self, shortcuts):
        self.shortcuts = shortcuts
        self.hotkey_manager.reload_shortcuts()

    def get_status(self):
        return {
            "status": self.current_status,
            "is_recording": self.is_recording,
            "is_transcribing": self.is_transcribing,
            "language": self.current_language,
            "model_size": self.model_size,
            "appearance": self.appearance,
            "widget_appearance": self.widget_appearance,
            "shortcuts": self.shortcuts,
            "engine": self.engine_name,
            "engine_remote": engines.is_remote(self.engine_name),
            "model_loaded": self.speech_recognizer is not None,
            "device": getattr(self.speech_recognizer, "device", None),
            "compute_type": getattr(self.speech_recognizer, "compute_type", None),
            # Diagnostic raccourcis : false = le poller est mort (watchdog
            # le relance, mais l'état doit être visible pour le debug)
            "hotkey_poll_alive": self.hotkey_manager.poll_alive,
            "hotkey_debug": self.hotkey_manager.poll_debug,
        }

    def list_devices(self):
        # sounddevice importé à la demande (~6 s à froid) : ne pas payer
        # l'init PortAudio au démarrage si l'UI ne liste pas les devices
        import sounddevice as sd
        devices = sd.query_devices()
        input_devices = []
        for i, dev in enumerate(devices):
            if dev["max_input_channels"] > 0:
                input_devices.append(
                    {
                        "id": i,
                        "name": dev["name"],
                        "channels": dev["max_input_channels"],
                        "default": i == sd.default.device[0],
                    }
                )
        return input_devices

    def set_device(self, device_id):
        try:
            import sounddevice as sd
            sd.default.device = (device_id, sd.default.device[1])
            self.selected_device = device_id
            return True
        except Exception as e:
            print(f"Erreur sélection périphérique: {e}")
            return False

    def set_quality(self, size):
        if size not in ["tiny", "base", "small", "medium", "large"]:
            return False
        self.model_size = size
        # Si le recognizer n'est pas encore chargé (lazy), rien à recharger :
        # la prochaine transcription utilisera la nouvelle taille
        if self.speech_recognizer is None:
            return True
        # Check-and-set atomique : pas deux rechargements concurrents
        with self._config_lock:
            if self.is_loading_model:
                return False
            self.is_loading_model = True
        # Recharger le modèle (ceci peut être lent)
        self._set_status(f"Chargement du modèle {size}...")

        def reload():
            try:
                # Construire le nouveau recognizer AVANT de remplacer
                # l'ancien : une transcription en cours conserve une
                # référence sur un objet pleinement initialisé
                recognizer = engines.create_engine(
                    self.engine_name, self.model_size, self.current_language,
                    key_resolver=self.engine_setting,
                )
                self.speech_recognizer = recognizer
                if not self.is_recording and not self.is_transcribing:
                    self._set_status("Prêt")
            except Exception as e:
                self._set_status(f"Erreur chargement: {str(e)}")
            finally:
                self.is_loading_model = False

        threading.Thread(target=reload, daemon=True).start()
        return True

    def set_language(self, lang):
        self.current_language = lang
        if self.speech_recognizer:
            self.speech_recognizer.language = lang
            # Mettre à jour les options de Whisper
            self.speech_recognizer.options["language"] = lang
        return True

    def set_theme(self, appearance_data):
        if isinstance(appearance_data, dict):
            self.appearance.update(appearance_data)
        elif isinstance(appearance_data, str):
            self.appearance["themeVariant"] = appearance_data

        # Sauvegarder dans la DB
        import json

        self.db_manager.set_setting("appearance", json.dumps(self.appearance))
        # Pousser l'état : sinon les fenêtres ne voient le changement qu'au
        # prochain événement — la "persistance" semblait cassée alors que
        # c'était juste la diffusion SSE qui manquait
        self._emit("status")
        return True

    def set_widget_appearance(self, appearance_data):
        """Apparence du widget flottant — indépendante du dashboard."""
        if not isinstance(appearance_data, dict):
            return False
        self.widget_appearance.update(appearance_data)
        import json

        self.db_manager.set_setting(
            "widget_appearance", json.dumps(self.widget_appearance)
        )
        self._emit("status")
        return True

    def toggle_recording(self):
        if self.is_recording:
            self.stop_recording()
        else:
            self.start_recording()

    def start_recording(self):
        if self.is_loading_model:
            self._set_status("Chargement du modèle en cours...")
            return
        if not self.is_recording:
            # Poser le flag AVANT l'appel bloquant (wait jusqu'à 3s) : sinon une
            # requête concurrente peut franchir la garde et doubler le stream
            self.is_recording = True
            try:
                self.audio_recorder.start_recording()
                self._set_status("🔴 Enregistrement...")
            except Exception as e:
                self.is_recording = False
                self._set_status(f"Erreur: {str(e)}")

    def stop_recording(self):
        if self.is_recording:
            self.is_recording = False
            self._set_status("🔄 Transcription...")
            print("Arrêt de l'enregistrement demandé")

            def process():
                audio_path = None
                try:
                    audio_path = self.audio_recorder.stop_recording()
                    if audio_path:
                        print(f"WAV temporaire écrit: {audio_path}")
                        # Sérialise l'inférence : deux transcriptions parallèles
                        # satureraient le CPU (et le modèle n'est pas prévu pour)
                        with self._transcribe_lock:
                            self.is_transcribing = True
                            # Émettre l'état : le widget passe en animation
                            # "transcription" — sinon il retombait sur l'état
                            # d'attente pendant le travail du modèle
                            self._emit("status")
                            t0 = time.time()
                            try:
                                text = self._get_recognizer().transcribe(audio_path)
                            finally:
                                self.is_transcribing = False
                            print(
                                f"Transcription terminée en {time.time() - t0:.1f}s "
                                f"({len(text)} caractères)"
                            )
                        if text:
                            self.db_manager.save_transcription(
                                text, language=self.current_language
                            )
                            ok = self.text_injector.inject_text(text)
                            print(f"Injection de texte: {'OK' if ok else 'échec'}")
                            self._emit("history")
                    else:
                        print("Aucune frame audio capturée — rien à transcrire")

                    self._set_status("Prêt")
                except Exception as e:
                    print(f"Erreur transcription: {e}")
                    traceback.print_exc()
                    self._set_status(f"Erreur: {str(e)}")
                finally:
                    # Nettoyage du fichier temp (le moteur vanilla le fait déjà,
                    # faster-whisper non — on couvre les deux cas)
                    if audio_path:
                        try:
                            os.unlink(audio_path)
                        except OSError:
                            pass

            threading.Thread(target=process, daemon=True).start()

    def start_hold_recording(self):
        """Appelé par HotkeyManager pour le mode PTT"""
        if self.is_loading_model or self.is_recording:
            return
        self.is_recording = True
        try:
            self.audio_recorder.start_recording()
            self._set_status("🔴 Enregistrement (PTT)...")
        except Exception as e:
            self.is_recording = False
            self._set_status(f"Erreur: {str(e)}")

    def stop_hold_recording(self):
        """Appelé par HotkeyManager pour le mode PTT"""
        if self.is_recording:
            self.stop_recording()

    def get_history(self, limit=50):
        db_history = self.db_manager.get_transcriptions(limit)
        history = []
        for item in db_history:
            # Format timestamp for display (ISO to FR)
            try:
                dt = datetime.strptime(item[2], "%Y-%m-%d %H:%M:%S")
                formatted_ts = dt.strftime("%d/%m/%Y %H:%M:%S")
            except:
                formatted_ts = item[2]

            history.append({"id": item[0], "text": item[1], "timestamp": formatted_ts})
        return history

    def delete_transcription(self, id):
        return self.db_manager.delete_transcription(id)
