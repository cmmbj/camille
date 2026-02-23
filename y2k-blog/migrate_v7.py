import sqlite3

def migrate():
    db_path = 'database.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Update all existing users profile picture
    try:
        cursor.execute("UPDATE users SET profile_picture = 'https://i.pinimg.com/736x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg'")
        print("Updated all profile pictures to the new default.")
    except Exception as e:
        print(f"Error updating PFPs: {e}")

    # Create conversation_settings table
    try:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS conversation_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                nickname TEXT,
                show_read_receipts BOOLEAN DEFAULT 1,
                ephemeral_mode BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (friend_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, friend_id)
            )
        ''')
        print("Created conversation_settings table.")
    except Exception as e:
        print(f"Error creating conversation_settings table: {e}")
        
    conn.commit()
    conn.close()

if __name__ == '__main__':
    migrate()
