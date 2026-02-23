import sqlite3
import os

def init_db():
    db_path = 'database.db'
    # For a fresh start with the new schema, we can remove the old DB if it exists
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create Users table (with new profile fields and status fields)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            display_name TEXT,
            bio TEXT,
            profile_picture TEXT,
            music_link TEXT,
            status_note TEXT,
            last_active TIMESTAMP
        )
    ''')
    
    # Create Posts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            author_id INTEGER,
            FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create Comments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            author_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create Likes table
    # item_type can be 'post' or 'comment'
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id, item_type, item_id)
        )
    ''')
    
    # Create Messages table (DMs)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            is_read BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create Friends table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(sender_id, receiver_id)
        )
    ''')
    
    # Create Blocks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blocker_id INTEGER NOT NULL,
            blocked_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (blocker_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (blocked_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(blocker_id, blocked_id)
        )
    ''')
    
    # Insert default admin user
    cursor.execute('''
        INSERT INTO users (username, password, role, display_name, bio, profile_picture, music_link) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        'admin', 
        'password', 
        'admin', 
        'Tessia ✨', 
        'Hi! I\'m Tessia 💖 Welcome to my personal space on the internet.\nMood: ~ dreamy ~ ☁️✨',
        'https://i.pinimg.com/736x/21/e2/0a/21e20a2e76f6ae8589c381f9b3bba2a2.jpg',
        'https://open.spotify.com/embed/playlist/5V57uxsKcP7yiJCMhUxMZr?utm_source=generator' # Warm playlist override
    ))
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database customized successfully with new tables!")
