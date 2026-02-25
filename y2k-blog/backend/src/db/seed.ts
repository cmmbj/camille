import { db } from './index';
import { users, posts, comments, friends } from './schema';
import { eq } from 'drizzle-orm';

export async function seedDatabase() {
    // Check if there are already users
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
        console.log("Database already has data, skipping seed.");
        return;
    }

    console.log("Seeding database with demo data...");

    const now = new Date().toISOString();
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();

    // Create admin user (password: password)
    const adminHash = await Bun.password.hash("password");
    await db.insert(users).values({
        username: "admin",
        display_name: "Tessia",
        password_hash: adminHash,
        profile_picture: "https://i.pinimg.com/736x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg",
        bio: "Bienvenue sur mon espace ! Je suis Tessia, la creatrice de ce petit coin mignon sur internet. J'adore la musique, les fleurs et le Y2K aesthetic.",
        music_link: "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
        role: "admin",
        status_note: "Creating vibes~",
        last_active: now
    });

    // Create guest user (password: password)
    const guestHash = await Bun.password.hash("password");
    await db.insert(users).values({
        username: "invite",
        display_name: "Invite Kawaii",
        password_hash: guestHash,
        profile_picture: "https://i.pinimg.com/736x/c5/ab/41/c5ab41e7a1c2e66f9d3e2c3d8f5b0a1e.jpg",
        bio: "Just visiting this cute space!",
        role: "user",
        status_note: "Exploring~",
        last_active: hourAgo
    });

    // Create another user
    const user3Hash = await Bun.password.hash("password");
    await db.insert(users).values({
        username: "sakura",
        display_name: "Sakura Chan",
        password_hash: user3Hash,
        profile_picture: "https://i.pinimg.com/736x/f7/73/c3/f773c3a77be3b03a28e86e3b5b2e3d0e.jpg",
        bio: "Cherry blossom lover, anime fan, and coding enthusiast!",
        role: "user",
        status_note: "Watching anime",
        last_active: dayAgo
    });

    // Make admin and invite friends
    await db.insert(friends).values({ senderId: 1, receiverId: 2, status: 'accepted', createdAt: dayAgo });
    await db.insert(friends).values({ senderId: 1, receiverId: 3, status: 'accepted', createdAt: dayAgo });
    await db.insert(friends).values({ senderId: 2, receiverId: 3, status: 'accepted', createdAt: dayAgo });

    // Create some posts
    await db.insert(posts).values({
        authorId: 1,
        content: "<p>Bienvenue sur <strong>Tessia's Diary</strong> ! Mon petit espace Y2K ou on partage des bonnes vibes. N'hesitez pas a vous inscrire et poster !</p>",
        postType: "message",
        visibility: "public",
        createdAt: dayAgo
    });

    await db.insert(posts).values({
        authorId: 2,
        content: "<p>Hello tout le monde ! Je viens de decouvrir ce site et il est trop mignon ! J'adore le design retro.</p>",
        postType: "message",
        visibility: "public",
        createdAt: hourAgo
    });

    await db.insert(posts).values({
        authorId: 3,
        content: "<p>Premier post ici ! Les cerisiers sont en fleurs cette saison, c'est magnifique.</p>",
        postType: "message",
        visibility: "public",
        createdAt: now
    });

    await db.insert(posts).values({
        authorId: 1,
        content: "<p>Post reserve a mes amis : voici une playlist secrete que j'ecoute en boucle !</p>",
        postType: "message",
        visibility: "friends",
        createdAt: now
    });

    // Add some comments
    await db.insert(comments).values({
        postId: 1,
        authorId: 2,
        content: "<p>Trop cool ce site Tessia ! Merci de nous accueillir.</p>",
        createdAt: hourAgo
    });

    await db.insert(comments).values({
        postId: 2,
        authorId: 1,
        content: "<p>Contente que ca te plaise ! Bienvenue !</p>",
        createdAt: now
    });

    console.log("Database seeded successfully!");
}
