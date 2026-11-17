import pyperclip
import time
import logging

# Configuration du logging
logger = logging.getLogger(__name__)

# pyautogui est importé paresseusement : son import tire ~8 s au démarrage
# à froid (pyscreeze/pymsgbox/PIL). L'injection n'a lieu qu'après une
# transcription — différer ne pénalise que le premier collage, pas le boot.
_pyautogui = None


def _get_pyautogui():
    global _pyautogui
    if _pyautogui is None:
        import pyautogui
        pyautogui.PAUSE = 0.1
        pyautogui.FAILSAFE = True
        _pyautogui = pyautogui
    return _pyautogui


class TextInjector:
    def __init__(self):
        logger.info("TextInjector initialisé")

    def inject_text(self, text):
        """
        Inject text at the current cursor position
        """
        logger.info(f"Tentative d'injection de texte: '{text[:50]}...' (longueur: {len(text)})")
        try:
            # Copy text to clipboard
            logger.info("Copie du texte dans le presse-papiers...")
            pyperclip.copy(text)
            logger.info("Texte copié avec succès")

            # Simulate Ctrl+V to paste
            logger.info("Simulation de Ctrl+V pour coller le texte...")
            pyautogui = _get_pyautogui()
            pyautogui.hotkey('ctrl', 'v')
            logger.info("Ctrl+V simulé avec succès")

            # Small delay to ensure paste completes
            time.sleep(0.1)
            logger.info("Texte injecté avec succès")
            return True

        except Exception as e:
            logger.error(f"Erreur lors de l'injection de texte: {e}")
            logger.error(f"Détails de l'erreur - Type: {type(e).__name__}")
            return False
