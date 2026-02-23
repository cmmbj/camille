# Tessia's Diary (Y2K Blog) 💖✨

Bienvenue sur le code source de **Tessia's Diary**, un blog personnel nostalgique reprenant l'esthétique des années 2000 (façon MySpace/Skyblog), mais avec des fonctionnalités sociales modernes ! 

## 🎀 Fonctionnalités (Versions Actuelles)

### Core (V1-V4)
- Comptes utilisateurs (Inscription, Connexion, Modification du profil).
- Thème Dusty Rose chaleureux avec un lecteur Spotify intégré.
- "Statut" en ligne/absent/hors-ligne calculé automatiquement en fonction de la dernière activité (pastille colorée).
- Mention d'autres utilisateurs via `@username` (avec mise en évidence CSS).

### Connexions Sociales (V5)
- Système d'amis (Demande, Acceptation, Suppression).
- Système de blocage entre utilisateurs.
- Profils Publics (`/user/<username>`) ajustant les boutons d'interaction selon la relation.

### UI & Insta-DMs (V6)
- **Barre latérale de post ("+ Floating Button")**: Création de posts depuis n'importe où sans recharger la page.
- **Types de posts**: Message 💬, Photo 📸, Vidéo 🎥, Story ⏱.
- **Visibilité**: Les posts peuvent être "Publics" (🌍) ou restreints "Amis Uniquement" (👯‍♀️).
- **Messagerie faćon Instagram**: Double interface avec la liste des amis à gauche et la discussion à droite. Restrictions de DM strictes (uniquement entre amis).

### Paramètres Avancés de Messagerie (V7)
- **Formatage du temps relatif ("timeago")** : Affichage naturel des dates (e.g. "à l'instant", "il y a 2h", "hier").
- **Barre de Recherche** : Trouver rapidement un message dans la conversation active.
- **Réglages par conversation (⚙️)** : 
  - Définir un **Surnom (Nickname)** pour son ami.
  - Activer/Désactiver les confirmations de lecture (**Vu**).
  - Activer le **Mode Éphémère** (effacement automatique des messages datant de plus de 24h).
- **Photo de Profil par défaut** automatique et mignonne : https://i.pinimg.com/736x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg

## 🛠️ Stack Technique
- **Backend** : Python / Flask
- **Base de données** : SQLite (via `sqlite3`)
- **Frontend** : HTML5, Vanilla CSS / JS + Jinja2 Templates
- **Sécurité** : Hashing de mots de passe (`werkzeug.security`), assainissement HTML (`bleach`)

## 🚀 Lancement Local
1. `pip install flask markdown bleach`
2. `python models.py` (ou `python migrate_v7.py` si vous mettez à jour)
3. `python app.py`
4. Allez sur `http://127.0.0.1:5000` !
