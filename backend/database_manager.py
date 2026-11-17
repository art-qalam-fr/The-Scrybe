import os
import sqlite3
from datetime import datetime
import json

# Chemin absolu ancré à la racine du projet — indépendant du répertoire
# de lancement (avant : 'voice_dictation.db' relatif -> DB dupliquée selon le CWD)
from paths import data_dir
DEFAULT_DB_PATH = os.path.join(data_dir(), 'voice_dictation.db')

class DatabaseManager:
    def __init__(self, db_path=None):
        self.db_path = db_path or DEFAULT_DB_PATH
        # ':memory:' ou un nom de fichier simple n'ont pas de dossier parent
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        self.create_tables()

    def get_connection(self):
        """Create a database connection with UTF-8 encoding"""
        conn = sqlite3.connect(self.db_path, detect_types=sqlite3.PARSE_DECLTYPES|sqlite3.PARSE_COLNAMES)
        # Activer le support des clés étrangères
        conn.execute('PRAGMA foreign_keys = ON')
        # Définir l'encodage UTF-8
        conn.execute('PRAGMA encoding="UTF-8"')
        conn.text_factory = str  # Utiliser str au lieu de bytes pour le texte
        return conn

    def migrate_existing_data(self, cursor):
        """Migre les données existantes si nécessaire"""
        try:
            # Vérifier s'il y a des enregistrements sans langue
            cursor.execute("""
            SELECT id, metadata FROM transcriptions 
            WHERE language IS NULL OR language = ''
            """)
            records = cursor.fetchall()
            
            if records:
                print(f"Migration de {len(records)} enregistrements existants...")
                
                for record_id, metadata_str in records:
                    try:
                        # Essayer d'extraire la langue des métadonnées
                        language = 'fr'  # Valeur par défaut
                        if metadata_str and isinstance(metadata_str, str):
                            import ast
                            try:
                                metadata = ast.literal_eval(metadata_str) if metadata_str else {}
                                if isinstance(metadata, dict):
                                    language = metadata.get('transcription_language', 'fr')
                            except (ValueError, SyntaxError):
                                pass
                                
                        # Mettre à jour l'enregistrement avec la langue
                        cursor.execute(
                            "UPDATE transcriptions SET language = ? WHERE id = ?",
                            (language, record_id)
                        )
                        
                    except Exception as e:
                        print(f"Erreur lors de la migration de l'enregistrement {record_id}: {e}")
                
                print("Migration des données terminée avec succès")
                
        except Exception as e:
            print(f"Erreur lors de la migration des données: {e}")
    
    def create_tables(self):
        """Create the necessary tables if they don't exist"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Vérifier si la table transcriptions existe déjà
            cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='transcriptions'
            """)
            table_exists = cursor.fetchone() is not None
            
            if not table_exists:
                # Créer la table si elle n'existe pas
                cursor.execute('''
                CREATE TABLE transcriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    text TEXT NOT NULL,
                    language TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT
                )
                ''')
            else:
                # Vérifier si la colonne 'language' existe
                cursor.execute("PRAGMA table_info(transcriptions)")
                columns = [col[1] for col in cursor.fetchall()]
                
                # Ajouter la colonne 'language' si elle n'existe pas
                if 'language' not in columns:
                    print("Ajout de la colonne 'language' à la table 'transcriptions'...")
                    cursor.execute('''
                    ALTER TABLE transcriptions 
                    ADD COLUMN language TEXT
                    ''')
                    
                    # Migrer les données existantes
                    self.migrate_existing_data(cursor)
            
            # Table for application settings
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
            ''')
            
            conn.commit()

    def save_transcription(self, text, language=None, metadata=None):
        """
        Save transcription to database with full text and language
        """
        if metadata is None:
            metadata = {}
            
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO transcriptions (text, language, timestamp, metadata)
                    VALUES (?, ?, ?, ?)
                    """,
                    (text, language, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), str(metadata))
                )
                conn.commit()
                return cursor.lastrowid
        except Exception as e:
            print(f"Erreur lors de la sauvegarde de la transcription: {e}")
            return None
            
    def get_transcription_by_id(self, id):
        """
        Récupère une transcription complète par son ID
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT text FROM transcriptions WHERE id = ?",
                    (id,)
                )
                result = cursor.fetchone()
                return result[0] if result else ""
        except Exception as e:
            print(f"Erreur lors de la récupération de la transcription: {e}")
            return ""

    def get_transcriptions(self, limit=50):
        """Retrieve recent transcriptions"""
        print(f"[DEBUG] Récupération des {limit} dernières transcriptions...")  # Log de débogage
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM transcriptions ORDER BY timestamp DESC LIMIT ?', (limit,))
                results = cursor.fetchall()
                print(f"[DEBUG] {len(results)} transcriptions récupérées depuis la base de données")  # Log de débogage
                return results
        except Exception as e:
            print(f"[ERREUR] Erreur lors de la récupération des transcriptions: {e}")  # Log d'erreur
            return []

    def get_setting(self, key, default=None):
        """Get an application setting"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
            result = cursor.fetchone()
            return result[0] if result else default

    def set_setting(self, key, value):
        """Set an application setting"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                (key, str(value))
            )
            conn.commit()

    def delete_transcription(self, transcription_id):
        """
        Supprime une transcription de la base de données par son ID
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "DELETE FROM transcriptions WHERE id = ?",
                    (transcription_id,)
                )
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Erreur lors de la suppression de la transcription {transcription_id}: {e}")
            return False
