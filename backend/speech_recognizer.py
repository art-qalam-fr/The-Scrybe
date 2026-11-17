import os
import torch
from model_loader import load_model

class SpeechRecognizer:
    def __init__(self, model_name="small", language="fr"):
        """
        Initialise le modèle Whisper pour la transcription
        Tailles de modèle disponibles: tiny, base, small, medium, large
        Les modèles plus grands sont plus précis mais plus lents
        Langues disponibles: fr (français), en (anglais), es (espagnol), etc.
        """
        self.language = language
        print(f"Chargement du modèle Whisper pour la langue: {language}")
        
        # Vérifier si un GPU est disponible
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Utilisation du périphérique: {self.device.upper()}")
        
        # Charger le modèle avec notre chargeur optimisé
        self.model = load_model(model_name)
        
        # Détecter automatiquement la langue si non spécifiée
        detect_language = None if language else True
        
        # Configurer les options de transcription
        self.options = {
            # 'language' = langue de SORTIE : parler X -> ecrire Y.
            # Ne jamais passer task a 'translate' (anglais uniquement).
            'language': language if language else None,  # None pour la détection automatique
            'task': 'transcribe',
            'fp16': torch.cuda.is_available(),  # FP16 uniquement sur GPU
            'temperature': 0,  # Moins de variations dans les résultats
            'best_of': 1,     # Accélère la transcription
            'beam_size': 1,   # Désactive la recherche par faisceau pour plus de vitesse
            'initial_prompt': None,  # Aucune instruction initiale
            'condition_on_previous_text': False,  # Meilleure précision pour les langues non latines
            'word_timestamps': False  # Désactivé pour améliorer les performances
        }
        
        # Configuration spécifique pour les langues non latines
        non_latin_scripts = ['ar', 'he', 'fa', 'ur', 'ps', 'ug', 'ku', 'sd', 'dv', 'yi', 'lad',
                           'zh', 'ja', 'ko', 'th', 'lo', 'km', 'my', 'ka', 'hy', 'mn', 'bo', 'dz',
                           'ne', 'si', 'ta', 'te', 'kn', 'ml', 'th', 'lo', 'km', 'my', 'ka', 'hy',
                           'ru', 'uk', 'be', 'bg', 'mk', 'sr', 'mn', 'tg', 'ky', 'kk', 'uz', 'az',
                           'et', 'fi', 'hu', 'el', 'hy', 'ka', 'he', 'yi', 'ar', 'fa', 'ur', 'ps',
                           'ug', 'sd', 'dv', 'ku', 'yi', 'lad']
        
        if language in non_latin_scripts:
            print(f"Configuration pour langue non latine détectée: {language}")
            self.options.update({
                'beam_size': 5,  # Augmenter la précision pour les langues non latines
                'best_of': 5,    # Meilleure qualité de transcription
                'condition_on_previous_text': True,  # Meilleure cohérence
                'word_timestamps': False  # Désactivé pour améliorer les performances
            })
        
        print(f"Modèle Whisper chargé avec succès (Modèle: {model_name}, Périphérique: {self.device.upper()}, Langue: {language if language else 'auto'})")
        
    def transcribe(self, audio_file_path):
        """
        Transcription d'un fichier audio en texte dans la langue configurée
        """
        if not audio_file_path or not os.path.exists(audio_file_path):
            return ""
            
        try:
            # Utiliser les options configurées pour la transcription
            result = self.model.transcribe(audio_file_path, **self.options)
            
            # Nettoyer le fichier temporaire
            try:
                os.unlink(audio_file_path)
            except:
                pass
                
            return result["text"].strip()
            
        except Exception as e:
            print(f"Erreur de transcription: {e}")
            # Nettoyer le fichier temporaire en cas d'erreur
            try:
                os.unlink(audio_file_path)
            except:
                pass
            return ""