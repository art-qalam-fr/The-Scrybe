import whisper
import torch
from pathlib import Path
import os

# Chemin vers le dossier de cache pour les modèles
CACHE_DIR = os.path.join(Path.home(), '.cache', 'whisper_models')

# Créer le dossier de cache s'il n'existe pas
os.makedirs(CACHE_DIR, exist_ok=True)

def load_model(model_name="small"):
    """
    Charge le modèle Whisper avec mise en cache
    """
    print(f"Chargement du modèle {model_name}...")
    
    # Vérifier si un GPU est disponible
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Utilisation du périphérique: {device.upper()}")
    
    try:
        # Charger le modèle avec mise en cache
        model = whisper.load_model(
            name=model_name,
            device=device,
            download_root=CACHE_DIR
        )
        
        print(f"Modèle {model_name} chargé avec succès sur {device.upper()}")
        return model
        
    except Exception as e:
        print(f"Erreur lors du chargement du modèle: {e}")
        # En cas d'erreur, essayer de charger sans cache
        print("Tentative de chargement sans cache...")
        return whisper.load_model(model_name).to(device)
