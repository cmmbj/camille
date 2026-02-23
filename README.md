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
- **Messagerie façon Instagram**: Double interface avec la liste des amis à gauche et la discussion à droite. Restrictions de DM strictes (uniquement entre amis).

### Paramètres Avancés de Messagerie (V7)
- **Formatage du temps relatif ("timeago")** : Affichage naturel des dates (e.g. "à l'instant", "il y a 2h", "hier").
- **Barre de Recherche** : Trouver rapidement un message dans la conversation active.
- **Réglages par conversation (⚙️)** : 
  - Définir un **Surnom (Nickname)** pour son ami.
  - Activer/Désactiver les confirmations de lecture (**Vu**).
  - Activer le **Mode Éphémère** (effacement automatique des messages datant de plus de 24h).
- **Photo de Profil par défaut** automatique et mignonne : https://i.pinimg.com/736x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg

## 🛠️ Tech Stack
- **Backend :** Python avec le framework Flask
- **Base de données :** SQLite (via `sqlite3`)
- **Frontend :** HTML5, Vanilla CSS / JS + Jinja2 Templates
- **Sécurité** : Hashing de mots de passe (`werkzeug.security`), assainissement HTML (`bleach`)

## 📂 Contenu et rôle des fichiers

### Backend et Logique
- **`app.py`** : C'est le cœur de l'application (le serveur). Ce fichier contient toute la logique et les "routes" du site web :
  - Gestion des connexions et inscriptions (`/login`, `/register`, `/logout`).
  - Système de création de posts virtuels et visibilités (`visibility`, `post_type`).
  - Messagerie privée (`/messages`)
- **`models.py`** : Fichier gérant la structure de la base de données. Son exécution initialise le fichier `database.db` avec les tables nécessaires (`users`, `posts`, `comments`, `likes`, `friends`, `blocks`, `messages`, `conversation_settings`) et un compte administrateur par défaut.
- **`migrate_v7.py`** : Script de migration pour passer à la version 7 (ajoute la table des paramètres de conversation et la nouvelle PFP par défaut).
- **`database.db`** : (Généré automatiquement) Fichier SQLite contenant toutes les données du site web.

### Design et Templating
- **`static/style.css`** : Fichier contenant tout le design du site. Il définit la palette de couleurs (rose grisâtre/chaleureux), le motif de fond en Tartan, et les icônes brillantes.
- **`templates/base.html`** : Le "cadre" principal du site, contenant la barre de navigation et le bouton "Nouveau Post" flottant.
- **`templates/index.html`** : La page d'accueil avec son lecteur Spotify intégré.
- **`templates/messages.html`** : Double panel de discussion privées façon Instagram.
- **`templates/public_profile.html`** : Profils de partage sociaux.
- **`templates/login.html`** & **`templates/register.html`** : Les pages d'authentification.
- **`templates/edit_profile.html`** : Paramètres du compte.

## 🚀 Lancement Local

1. Ouvrir le dossier `y2k-blog` dans un terminal.
2. Installer les paquets : `pip install flask markdown bleach`
3. Activer l'environnement virtuel : `.\venv\Scripts\Activate.ps1`
4. Initialiser la BD : `python models.py` (ou `python migrate_v7.py` si vous mettez à jour)
5. Lancer le site web : `python app.py`
6. Ouvrir `http://127.0.0.1:5000` dans ton navigateur internet !
