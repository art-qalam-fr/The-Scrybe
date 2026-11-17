# Avis sur les composants tiers / Third-Party Notices

The Scrybe intègre ou s'appuie sur les composants open source suivants.
Tous sont distribués sous licences permissives compatibles avec la
redistribution dans cette application.

## Backend Python

| Composant | Licence | Usage |
|---|---|---|
| faster-whisper | MIT | Moteur de transcription local |
| CTranslate2 | MIT | Runtime d'inférence Whisper |
| OpenAI Whisper (modèles) | MIT | Poids de modèles téléchargés à l'exécution (HuggingFace) |
| sounddevice / PortAudio | MIT | Capture microphone |
| keyboard | MIT | Hook clavier secondaire |
| PyAutoGUI | BSD-3-Clause | Simulation Ctrl+V (injection) |
| pyperclip | BSD | Presse-papiers |
| Flask | BSD-3-Clause | API locale |
| PyTorch | BSD-3-Clause (+ Apache-2.0, MIT, Zlib…) | Backend CTranslate2 |
| NVIDIA CUDA / cuDNN runtime | NVIDIA EULA (redistribution autorisée) | DLLs embarquées via les wheels ctranslate2/torch |

## Frontend / Desktop

| Composant | Licence | Usage |
|---|---|---|
| Electron | MIT | Shell application desktop |
| Chromium (embarqué dans Electron) | BSD-3-Clause / LGPL | Moteur de rendu — voir `Licenses` de la distribution Electron |
| React | MIT | Interface utilisateur |
| Vite | MIT | Outil de build |
| axios | MIT | Requêtes HTTP |
| electron-builder | MIT | Packaging Windows/NSIS |
| Node.js | MIT | Runtime de build |

## Note sur le modèle Whisper

Les poids `small` de faster-whisper sont téléchargés au premier
lancement depuis HuggingFace (licence MIT, OpenAI). Le téléchargement
est effectué par l'utilisateur final à l'exécution ; aucun poids de
modèle n'est redistribué dans ce dépôt.

## Note sur les runtimes NVIDIA

Les DLLs CUDA/cuDNN présentes dans le build binaire proviennent des
wheels officiels `ctranslate2`/`torch`, dont la redistribution avec
une application est permise par la licence NVIDIA correspondante.
