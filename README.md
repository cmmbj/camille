# Y2K MySpace Blog

Bienvenue sur le projet Y2K MySpace Blog ! Ce code permet de faire tourner un site web personnel inspiré du design du début des années 2000 (Tartan rose chaleureux, paillettes, bulles).

## 🛠️ Tech Stack
- **Backend :** Python avec le framework Flask
- **Base de données :** SQLite
- **Frontend :** HTML + Vanilla CSS 

## 📂 Contenu et rôle des fichiers

### Backend et Logique
- **`app.py`** : C'est le cœur de l'application (le serveur). Ce fichier contient toute la logique et les "routes" du site web :
  - Gestion des connexions et inscriptions (`/login`, `/register`, `/logout`).
  - Système de création de posts avec conversion du Markdown vers HTML de façon sécurisée (avec `bleach`).
  - Système d'interactions (`/like/`, `/comment/`).
  - Logique d'affichage du profil (`/edit_profile`).
- **`models.py`** : Fichier gérant la structure de la base de données. Son exécution initialise le fichier `database.db` avec les tables nécessaires (`users`, `posts`, `comments`, `likes`) et un compte administrateur par défaut.
- **`database.db`** : (Généré automatiquement) Fichier SQLite contenant toutes les données du site web.

### Design et Templating
- **`static/style.css`** : Fichier contenant tout le design du site. Il définit la palette de couleurs (rose grisâtre/chaleureux), le motif de fond en Tartan, et les animations brillantes/dynamiques qui donnent cet aspect Y2K/Myspace.
- **`templates/base.html`** : Le "cadre" principal du site, contenant la barre de navigation et le fond étoilé. Tous les autres fichiers HTML viennent s'insérer dedans.
- **`templates/index.html`** : La page d'accueil. Elle affiche ton profil (avec lecteur Spotify intégré) et le fil d'actualités avec les posts, likes et commentaires.
- **`templates/login.html`** & **`templates/register.html`** : Les pages de connexion et de création de compte.
- **`templates/edit_profile.html`** : La page permettant de personnaliser sa bio, son nom, son image de profil et son lien de musique.
- **`templates/new_post.html`** : Le formulaire (réservé à l'admin) pour écrire un nouveau post de blog.

## 🚀 Comment lancer le projet

1. Ouvrir le dossier `y2k-blog` dans un terminal.
2. Activer l'environnement virtuel : `.\venv\Scripts\Activate.ps1`
3. Lancer le site web : `python app.py`
4. Ouvrir `http://127.0.0.1:5000` dans ton navigateur internet.
