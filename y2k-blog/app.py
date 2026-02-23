import sqlite3
import markdown
import bleach
import re
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'y2k_myspace_super_secret_key'

# Allowed tags and attributes for bleach (to keep markdown safe but allow styling/images)
ALLOWED_TAGS = [
    'a', 'abbr', 'acronym', 'b', 'blockquote', 'code', 'em', 'i', 'li', 'ol', 'strong', 
    'ul', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'hr', 'span'
]
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title'],
    'span': ['class', 'style']
}

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def parse_mentions(text):
    """Finds @username and wraps it in a styled span."""
    # This regex looks for @ followed by word characters
    pattern = r'@(\w+)'
    # Replace with a styled span
    styled_mention = r'<span class="mention">@\1</span>'
    return re.sub(pattern, styled_mention, text)

@app.context_processor
def inject_unread_count():
    if 'user_id' in session:
        conn = get_db_connection()
        count = conn.execute('SELECT COUNT(id) FROM messages WHERE receiver_id = ? AND is_read = 0', (session['user_id'],)).fetchone()[0]
        conn.close()
        return dict(unread_messages_count=count)
    return dict(unread_messages_count=0)

# Update last active timestamp for logged in users
@app.before_request
def update_last_active():
    if 'user_id' in session:
        conn = get_db_connection()
        conn.execute('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = ?', (session['user_id'],))
        conn.commit()
        conn.close()

@app.template_filter('timeago')
def timeago_filter(dt_str):
    if not dt_str:
        return ""
    try:
        # SQLite CURRENT_TIMESTAMP format: 'YYYY-MM-DD HH:MM:SS'
        dt = datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S')
        now = datetime.utcnow()
        diff = now - dt
        
        if diff.days == 0:
            if diff.seconds < 60:
                return "à l'instant"
            elif diff.seconds < 3600:
                mins = diff.seconds // 60
                return f"il y a {mins} min"
            else:
                hours = diff.seconds // 3600
                return f"il y a {hours}h"
        elif diff.days == 1:
            return "hier"
        elif diff.days < 7:
            return f"il y a {diff.days} jours"
        elif diff.days < 30:
            weeks = diff.days // 7
            if weeks == 1:
                return "il y a 1 semaine"
            return f"il y a {weeks} semaines"
        elif diff.days < 365:
            months = diff.days // 30
            if months == 1:
                return "il y a 1 mois"
            return f"il y a {months} mois"
        else:
            years = diff.days // 365
            if years == 1:
                return "il y a 1 an"
            return f"il y a {years} ans"
    except Exception:
        return dt_str

def get_user_status(last_active_str):
    """Determine Online/Away/Offline based on last_active timestamp string from DB"""
    if not last_active_str:
        return {'label': 'Déconnecté', 'color': '🔴'}
        
    try:
        # SQLite stores as YYYY-MM-DD HH:MM:SS (UTC usually, but let's assume local for simplicity here)
        last_active = datetime.strptime(last_active_str, '%Y-%m-%d %H:%M:%S')
        now = datetime.utcnow() # match sqlite CURRENT_TIMESTAMP
        
        diff = now - last_active
        minutes = diff.total_seconds() / 60
        
        if minutes < 5:
            return {'label': 'En ligne', 'color': '🟢'}
        else:
            return {'label': 'En veille', 'color': '🟡'}
    except Exception:
        return {'label': 'Déconnecté', 'color': '🔴'}

@app.route('/')
def index():
    conn = get_db_connection()
    
    if 'user_id' in session:
        user_id = session['user_id']
        posts_data = conn.execute('''
            SELECT DISTINCT posts.id, posts.content, posts.post_type, posts.visibility, posts.created_at, 
                   users.username, users.display_name, users.profile_picture 
            FROM posts 
            JOIN users ON posts.author_id = users.id 
            LEFT JOIN friends f1 ON (f1.sender_id = ? AND f1.receiver_id = posts.author_id AND f1.status = 'accepted')
            LEFT JOIN friends f2 ON (f2.sender_id = posts.author_id AND f2.receiver_id = ? AND f2.status = 'accepted')
            WHERE posts.visibility = 'public' 
               OR posts.author_id = ?
               OR (posts.visibility = 'friends' AND (f1.id IS NOT NULL OR f2.id IS NOT NULL))
            ORDER BY posts.created_at DESC
        ''', (user_id, user_id, user_id)).fetchall()
    else:
        # Get all public posts
        posts_data = conn.execute('''
            SELECT posts.id, posts.content, posts.post_type, posts.visibility, posts.created_at, 
                   users.username, users.display_name, users.profile_picture 
            FROM posts 
            JOIN users ON posts.author_id = users.id 
            WHERE posts.visibility = 'public'
            ORDER BY posts.created_at DESC
        ''').fetchall()
    
    posts = []
    # For each post, fetch its likes and comments
    for p in posts_data:
        post_dict = dict(p)
        
        # Determine if the current user liked this post
        current_user_liked = False
        likes_count = 0
        likes_data = conn.execute('SELECT user_id FROM likes WHERE item_type = "post" AND item_id = ?', (p['id'],)).fetchall()
        likes_count = len(likes_data)
        if 'user_id' in session:
            current_user_liked = any(l['user_id'] == session['user_id'] for l in likes_data)
            
        # Get comments
        comments_data = conn.execute('''
            SELECT comments.id, comments.content, comments.created_at, 
                   users.username, users.display_name, users.profile_picture 
            FROM comments 
            JOIN users ON comments.author_id = users.id 
            WHERE comments.post_id = ?
            ORDER BY comments.created_at ASC
        ''', (p['id'],)).fetchall()
        
        comments = []
        for c in comments_data:
            c_dict = dict(c)
            # Fetch likes for comment
            c_likes_data = conn.execute('SELECT user_id FROM likes WHERE item_type = "comment" AND item_id = ?', (c['id'],)).fetchall()
            c_dict['likes'] = len(c_likes_data)
            c_dict['current_user_liked'] = any(l['user_id'] == session.get('user_id') for l in c_likes_data) if 'user_id' in session else False
            comments.append(c_dict)
            
        post_dict['likes'] = likes_count
        post_dict['current_user_liked'] = current_user_liked
        post_dict['comments'] = comments
        posts.append(post_dict)
        
    # Get profile data for the sidebar/header
    # If user is logged in, show their profile, else fallback to admin
    profile_user = None
    if 'user_id' in session:
        profile_user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if not profile_user:
        profile_user = conn.execute('SELECT * FROM users WHERE role = "admin" ORDER BY id ASC LIMIT 1').fetchone()
        
    # Calculate statuses for all posts and comments
    for post in posts:
        # We need the author's last active to show their status circle
        author_data = conn.execute('SELECT last_active FROM users WHERE username = ?', (post['username'],)).fetchone()
        post['author_status'] = get_user_status(author_data['last_active'] if author_data else None)
        
        for comment in post['comments']:
            c_author_data = conn.execute('SELECT last_active FROM users WHERE username = ?', (comment['username'],)).fetchone()
            comment['author_status'] = get_user_status(c_author_data['last_active'] if c_author_data else None)
            
    # Calculate status for the currently displayed profile
    profile_status = None
    if profile_user:
        profile_user_dict = dict(profile_user)
        profile_status = get_user_status(profile_user_dict.get('last_active'))
        profile_user = profile_user_dict
    
    conn.close()
    return render_template('index.html', posts=posts, profile_user=profile_user, profile_status=profile_status)

@app.route('/login', methods=('GET', 'POST'))
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()

        # Simple verification. Admin is pre-inserted with plain 'password'
        # New users will have hashed passwords, so we check both for compatibility with our dummy init
        valid = False
        if user:
            if user['password'] == password: 
                valid = True
            elif check_password_hash(user['password'], password):
                valid = True

        if valid:
            session.clear()
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            return redirect(url_for('index'))
        else:
            flash('Identifiants incorrects.')

    return render_template('login.html')

@app.route('/register', methods=('GET', 'POST'))
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        display_name = request.form['display_name'] or username
        
        conn = get_db_connection()
        user = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
        
        if user:
            flash('Ce nom d\'utilisateur est déjà pris.')
        elif not username or not password:
            flash('Nom d\'utilisateur et mot de passe requis.')
        else:
            hashed_pw = generate_password_hash(password)
            default_pfp = 'https://i.pinimg.com/736x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg' # Global default
            
            conn.execute('''
                INSERT INTO users (username, password, role, display_name, profile_picture) 
                VALUES (?, ?, 'user', ?, ?)
            ''', (username, hashed_pw, display_name, default_pfp))
            conn.commit()
            conn.close()
            flash('Compte créé avec succès ! Connecte-toi 💖')
            return redirect(url_for('login'))
            
        conn.close()
        
    return render_template('register.html')

@app.route('/logout')
def logout():
    if 'user_id' in session:
        conn = get_db_connection()
        conn.execute('UPDATE users SET last_active = NULL WHERE id = ?', (session['user_id'],))
        conn.commit()
        conn.close()
    session.clear()
    return redirect(url_for('index'))

@app.route('/edit_profile', methods=('GET', 'POST'))
def edit_profile():
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    
    if request.method == 'POST':
        new_username = request.form['username'].strip()
        display_name = request.form['display_name']
        bio = request.form['bio']
        profile_picture = request.form['profile_picture']
        music_link = request.form['music_link']
        status_note = request.form['status_note']
        
        # Check if username is taken by someone else
        existing_user = conn.execute('SELECT id FROM users WHERE username = ? AND id != ?', (new_username, session['user_id'])).fetchone()
        
        if existing_user:
            flash('Ce nom d\'utilisateur est déjà pris par quelqu\'un d\'autre.')
        elif not new_username:
            flash('Le nom d\'utilisateur ne peut pas être vide.')
        else:
            conn.execute('''
                UPDATE users 
                SET username = ?, display_name = ?, bio = ?, profile_picture = ?, music_link = ?, status_note = ?
                WHERE id = ?
            ''', (new_username, display_name, bio, profile_picture, music_link, status_note, session['user_id']))
            conn.commit()
            
            # Update session in case username changed
            session['username'] = new_username
            flash('Profil mis à jour ! ✨')
            return redirect(url_for('index'))
            
    conn.close()
    return render_template('edit_profile.html', user=user)

@app.route('/user/<username>')
def public_profile(username):
    conn = get_db_connection()
    target_user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    
    if not target_user:
        conn.close()
        flash('Utilisateur introuvable.')
        return redirect(url_for('index'))
        
    target_user_dict = dict(target_user)
    target_user_dict['status'] = get_user_status(target_user_dict.get('last_active'))
    
    # Check relationship if user is logged in
    relationship = None
    if 'user_id' in session:
        current_user_id = session['user_id']
        target_id = target_user['id']
        
        if current_user_id != target_id:
            # Check if blocked
            block = conn.execute('SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?', 
                                 (current_user_id, target_id)).fetchone()
            is_blocked_by_me = bool(block)
            
            # Check if I am blocked by them
            blocked_by_them = conn.execute('SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?', 
                                           (target_id, current_user_id)).fetchone()
                                           
            if blocked_by_them:
                conn.close()
                flash('Vous ne pouvez pas voir ce profil.')
                return redirect(url_for('index'))
                
            # Check friendship status
            friend_request = conn.execute('''
                SELECT * FROM friends 
                WHERE (sender_id = ? AND receiver_id = ?) 
                   OR (sender_id = ? AND receiver_id = ?)
            ''', (current_user_id, target_id, target_id, current_user_id)).fetchone()
            
            if friend_request:
                if friend_request['status'] == 'accepted':
                    relationship = 'friends'
                elif friend_request['sender_id'] == current_user_id:
                    relationship = 'request_sent'
                else:
                    relationship = 'request_received'
            else:
                relationship = 'none'
                
            if is_blocked_by_me:
                relationship = 'blocked'
    
    # Fetch user's posts
    if relationship == 'friends' or ('user_id' in session and session['user_id'] == target_user['id']):
        # Friends or self: see public and friends posts
        posts_data = conn.execute('''
            SELECT posts.id, posts.content, posts.post_type, posts.visibility, posts.created_at, 
                   users.username, users.display_name, users.profile_picture 
            FROM posts 
            JOIN users ON posts.author_id = users.id 
            WHERE users.id = ?
              AND (posts.visibility = 'public' OR posts.visibility = 'friends')
            ORDER BY posts.created_at DESC
        ''', (target_user['id'],)).fetchall()
    else:
        # Non-friends: see only public posts
        posts_data = conn.execute('''
            SELECT posts.id, posts.content, posts.post_type, posts.visibility, posts.created_at, 
                   users.username, users.display_name, users.profile_picture 
            FROM posts 
            JOIN users ON posts.author_id = users.id 
            WHERE users.id = ?
              AND posts.visibility = 'public'
            ORDER BY posts.created_at DESC
        ''', (target_user['id'],)).fetchall()
    
    posts = [dict(p) for p in posts_data]
    
    conn.close()
    return render_template('public_profile.html', user=target_user_dict, posts=posts, relationship=relationship)

@app.route('/add_friend/<int:target_id>', methods=['POST'])
def add_friend(target_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    current_user_id = session['user_id']
    if current_user_id == target_id:
        return redirect(url_for('index'))
        
    conn = get_db_connection()
    # Check if already friends or pending
    existing = conn.execute('''
        SELECT * FROM friends 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
    ''', (current_user_id, target_id, target_id, current_user_id)).fetchone()
    
    if not existing:
        conn.execute('INSERT INTO friends (sender_id, receiver_id) VALUES (?, ?)', 
                     (current_user_id, target_id))
        conn.commit()
        flash('Demande d\'ami envoyée ! 💌')
        
    target_user = conn.execute('SELECT username FROM users WHERE id = ?', (target_id,)).fetchone()
    conn.close()
    
    if target_user:
        return redirect(url_for('public_profile', username=target_user['username']))
    return redirect(url_for('index'))

@app.route('/accept_friend/<int:target_id>', methods=['POST'])
def accept_friend(target_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    current_user_id = session['user_id']
    conn = get_db_connection()
    
    conn.execute('''
        UPDATE friends SET status = 'accepted' 
        WHERE sender_id = ? AND receiver_id = ?
    ''', (target_id, current_user_id))
    
    conn.commit()
    target_user = conn.execute('SELECT username FROM users WHERE id = ?', (target_id,)).fetchone()
    conn.close()
    
    flash('Demande d\'ami acceptée ! 💖')
    return redirect(url_for('public_profile', username=target_user['username']))

@app.route('/remove_friend/<int:target_id>', methods=['POST'])
def remove_friend(target_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    current_user_id = session['user_id']
    conn = get_db_connection()
    
    conn.execute('''
        DELETE FROM friends 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
    ''', (current_user_id, target_id, target_id, current_user_id))
    
    conn.commit()
    target_user = conn.execute('SELECT username FROM users WHERE id = ?', (target_id,)).fetchone()
    conn.close()
    
    flash('Ami(e) supprimé(e).')
    return redirect(url_for('public_profile', username=target_user['username']))

@app.route('/block_user/<int:target_id>', methods=['POST'])
def block_user(target_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    current_user_id = session['user_id']
    conn = get_db_connection()
    
    # Remove friendship if exists
    conn.execute('''
        DELETE FROM friends 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
    ''', (current_user_id, target_id, target_id, current_user_id))
    
    # Add block
    existing_block = conn.execute('SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?', 
                                  (current_user_id, target_id)).fetchone()
    if not existing_block:
        conn.execute('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', 
                     (current_user_id, target_id))
        
    conn.commit()
    conn.close()
    
    flash('Utilisateur bloqué. 🛑')
    return redirect(url_for('index'))

@app.route('/unblock_user/<int:target_id>', methods=['POST'])
def unblock_user(target_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    current_user_id = session['user_id']
    conn = get_db_connection()
    
    conn.execute('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', 
                 (current_user_id, target_id))
    
    conn.commit()
    target_user = conn.execute('SELECT username FROM users WHERE id = ?', (target_id,)).fetchone()
    conn.close()
    
    flash('Utilisateur débloqué.')
    return redirect(url_for('public_profile', username=target_user['username']))

@app.route('/post/new', methods=('GET', 'POST'))
def new_post():
    if 'user_id' not in session:
        flash('Vous devez être connecté pour poster.')
        return redirect(url_for('login'))

    if request.method == 'POST':
        raw_content = request.form.get('content')
        post_type = request.form.get('post_type', 'message')
        visibility = request.form.get('visibility', 'public')
        
        if not raw_content:
            flash('Le contenu est requis!')
        else:
            # Parse mentions FIRST, then Markdown
            content_with_mentions = parse_mentions(raw_content)
            html_content = markdown.markdown(content_with_mentions)
            
            # Sanitize the HTML
            clean_content = bleach.clean(html_content, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)

            conn = get_db_connection()
            conn.execute('INSERT INTO posts (content, post_type, visibility, author_id) VALUES (?, ?, ?, ?)',
                         (clean_content, post_type, visibility, session['user_id']))
            conn.commit()
            conn.close()
            flash('Post publié avec succès ! ✨')
            return redirect(url_for('index'))

    return redirect(url_for('index'))

@app.route('/comment/<int:post_id>', methods=('POST',))
def add_comment(post_id):
    if 'user_id' not in session:
        flash('Connecte-toi pour commenter !')
        return redirect(url_for('login'))
        
    content = request.form['content'].strip()
    if content:
        # Simple text for comments, maybe allow basic markdown
        html_content = markdown.markdown(content)
        clean_content = bleach.clean(html_content, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)

        conn = get_db_connection()
        conn.execute('INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)',
                     (post_id, session['user_id'], clean_content))
        conn.commit()
        conn.close()
        
    return redirect(url_for('index'))

@app.route('/like/<item_type>/<int:item_id>', methods=('POST',))
def toggle_like(item_type, item_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    if item_type not in ['post', 'comment']:
        return redirect(url_for('index'))
        
    conn = get_db_connection()
    user_id = session['user_id']
    
    # Check if already liked
    existing_like = conn.execute('SELECT id FROM likes WHERE user_id = ? AND item_type = ? AND item_id = ?', 
                                 (user_id, item_type, item_id)).fetchone()
                                 
    if existing_like:
        # Unlike
        conn.execute('DELETE FROM likes WHERE id = ?', (existing_like['id'],))
    else:
        # Like
        conn.execute('INSERT INTO likes (user_id, item_type, item_id) VALUES (?, ?, ?)', 
                     (user_id, item_type, item_id))
                     
    conn.commit()
    conn.close()
    
    return redirect(url_for('index'))

@app.route('/messages', defaults={'chat_username': None}, methods=('GET', 'POST'))
@app.route('/messages/<chat_username>', methods=('GET', 'POST'))
def messages(chat_username):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    user_id = session['user_id']
    
    # Fetch friend list for the sidebar
    friends_data = conn.execute('''
        SELECT u.id, u.username, u.display_name, u.profile_picture, u.last_active,
               (SELECT content FROM messages 
                WHERE (sender_id = u.id AND receiver_id = ?) 
                   OR (sender_id = ? AND receiver_id = u.id) 
                ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM messages 
                WHERE (sender_id = u.id AND receiver_id = ?) 
                   OR (sender_id = ? AND receiver_id = u.id) 
                ORDER BY created_at DESC LIMIT 1) as last_activity,
               (SELECT COUNT(id) FROM messages 
                WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread_count
        FROM users u
        JOIN friends f ON (f.sender_id = ? AND f.receiver_id = u.id) 
                       OR (f.sender_id = u.id AND f.receiver_id = ?)
        WHERE f.status = 'accepted'
    ''', (user_id, user_id, user_id, user_id, user_id, user_id, user_id)).fetchall()
    
    friends = []
    for f in friends_data:
        f_dict = dict(f)
        f_dict['status'] = get_user_status(f_dict.get('last_active'))
        friends.append(f_dict)
        
    # Sort by recent message activity (newest first)
    friends.sort(key=lambda x: (x['last_activity'] or ''), reverse=True)
    
    active_chat_user = None
    chat_messages = []
    my_settings = {}
    search_query = request.args.get('q', '').strip()
    
    if chat_username:
        active_chat_user = conn.execute('SELECT * FROM users WHERE username = ?', (chat_username,)).fetchone()
        
        if active_chat_user:
            active_chat_user_dict = dict(active_chat_user)
            active_chat_user_dict['status'] = get_user_status(active_chat_user_dict.get('last_active'))
            
            # Verify friendship to allow chatting
            is_friend = any(f['id'] == active_chat_user['id'] for f in friends)
            
            if not is_friend:
                flash("Vous ne pouvez discuter qu'avec vos amis.")
                return redirect(url_for('messages'))
                
            # --- V7: conversation settings ---
            # My settings
            my_settings = conn.execute('SELECT * FROM conversation_settings WHERE user_id = ? AND friend_id = ?', (user_id, active_chat_user['id'])).fetchone()
            if not my_settings:
                conn.execute('INSERT INTO conversation_settings (user_id, friend_id) VALUES (?, ?)', (user_id, active_chat_user['id']))
                conn.commit()
                my_settings = conn.execute('SELECT * FROM conversation_settings WHERE user_id = ? AND friend_id = ?', (user_id, active_chat_user['id'])).fetchone()
            my_settings = dict(my_settings)

            # Their settings
            their_settings = conn.execute('SELECT * FROM conversation_settings WHERE user_id = ? AND friend_id = ?', (active_chat_user['id'], user_id)).fetchone()
            if not their_settings:
                conn.execute('INSERT INTO conversation_settings (user_id, friend_id) VALUES (?, ?)', (active_chat_user['id'], user_id))
                conn.commit()
                their_settings = conn.execute('SELECT * FROM conversation_settings WHERE user_id = ? AND friend_id = ?', (active_chat_user['id'], user_id)).fetchone()
            their_settings = dict(their_settings)

            # Resolve nickname
            if my_settings.get('nickname'):
                active_chat_user_dict['display_name'] = my_settings['nickname']
            
            active_chat_user = active_chat_user_dict
            ephemeral = my_settings.get('ephemeral_mode') or their_settings.get('ephemeral_mode')
            
            if request.method == 'POST':
                content = request.form.get('content', '').strip()
                if content:
                    clean_content = bleach.clean(content)
                    conn.execute('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
                                 (user_id, active_chat_user['id'], clean_content))
                    conn.commit()
                    return redirect(url_for('messages', chat_username=chat_username))
            
            # Mark messages as read
            conn.execute('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
                         (active_chat_user['id'], user_id))
            conn.commit()
            
            # Fetch conversation
            query = '''
                SELECT m.*, u.username as sender_name, u.profile_picture as sender_pfp
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE ((m.sender_id = ? AND m.receiver_id = ?) 
                   OR (m.sender_id = ? AND m.receiver_id = ?))
            '''
            params = [user_id, active_chat_user['id'], active_chat_user['id'], user_id]

            if ephemeral:
                query += " AND m.created_at >= datetime('now', '-1 day')"
            
            if search_query:
                query += " AND m.content LIKE ?"
                params.append(f'%{search_query}%')
                
            query += " ORDER BY m.created_at ASC"
            
            messages_data = conn.execute(query, params).fetchall()
            chat_messages = [dict(m) for m in messages_data]
            
            if chat_messages and their_settings.get('show_read_receipts'):
                last_msg = chat_messages[-1]
                if last_msg['sender_id'] == user_id and last_msg['is_read']:
                    last_msg['show_vu'] = True
            
    conn.close()
    
    return render_template('messages.html', friends=friends, active_chat_user=active_chat_user, messages=chat_messages, my_settings=my_settings, search_query=search_query)

@app.route('/messages/<chat_username>/settings', methods=['POST'])
def update_conversation_settings(chat_username):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    user_id = session['user_id']
    friend = conn.execute('SELECT id FROM users WHERE username = ?', (chat_username,)).fetchone()
    if not friend:
        conn.close()
        return redirect(url_for('messages'))
        
    nickname = request.form.get('nickname', '').strip()
    show_read_receipts = 1 if request.form.get('show_read_receipts') else 0
    ephemeral_mode = 1 if request.form.get('ephemeral_mode') else 0
    
    settings = conn.execute('SELECT id FROM conversation_settings WHERE user_id = ? AND friend_id = ?', (user_id, friend['id'])).fetchone()
    if settings:
        conn.execute('''
            UPDATE conversation_settings
            SET nickname = ?, show_read_receipts = ?, ephemeral_mode = ?
            WHERE id = ?
        ''', (nickname if nickname else None, show_read_receipts, ephemeral_mode, settings['id']))
    else:
        conn.execute('''
            INSERT INTO conversation_settings (user_id, friend_id, nickname, show_read_receipts, ephemeral_mode)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, friend['id'], nickname if nickname else None, show_read_receipts, ephemeral_mode))
        
    conn.commit()
    conn.close()
    flash('Paramètres de discussion mis à jour !')
    return redirect(url_for('messages', chat_username=chat_username))

if __name__ == '__main__':
    app.run(debug=True)
