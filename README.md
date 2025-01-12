# ChatGenius

ChatGenius is an enterprise communication platform designed for seamless workplace messaging and real-time collaboration. Built with modern technologies, it provides a robust and user-friendly interface for professional communication.

## Features

- 🔄 Real-time messaging using Server-Sent Events (SSE)
- 👤 User profiles with customizable avatars
- 🔍 Message search functionality
- 📱 Responsive design for desktop and mobile
- 🎨 Customizable themes and appearance
- 💬 Channel-based communication
- 🔒 Secure authentication system
- 👥 User presence indicators
- 📎 File attachments with avatar uploads
- 💡 Rich user profiles with custom fields

## Technical Architecture

### Frontend
- **Framework**: TypeScript React with Vite
- **State Management**: React Query for server state
- **Routing**: Wouter for lightweight routing
- **UI Components**: shadcn/ui + Tailwind CSS
- **Real-time Updates**: Server-Sent Events (SSE)
- **Form Handling**: React Hook Form with Zod validation

### Backend
- **Server**: Express.js with TypeScript
- **Database**: SQLite with Drizzle ORM
- **Real-time**: SSE for push notifications
- **File Handling**: Multer for file uploads
- **Authentication**: Passport.js with sessions
- **API Design**: RESTful architecture

## API Endpoints

### Authentication
- `POST /api/register` - Create new user account
- `POST /api/login` - Authenticate user
- `POST /api/logout` - End user session
- `GET /api/user` - Get current user info

### Messages
- `GET /api/messages` - Get channel messages
- `POST /api/messages` - Send new message
- `GET /api/messages?channelId={id}` - Get messages for specific channel

### Channels
- `GET /api/channels` - List all channels
- `GET /api/channels/:id` - Get channel details

### Real-time Events
- `GET /api/events` - SSE endpoint for real-time updates
  - Message events
  - Presence updates
  - Typing indicators
  - Channel updates

### User Profile
- `PATCH /api/users/me` - Update user profile
- `POST /api/users/me/avatar` - Upload profile picture
- `POST /api/presence` - Update online status

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  about_me TEXT,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Channels Table
```sql
CREATE TABLE channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_private INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  is_edited INTEGER DEFAULT 0,
  delivery_status TEXT DEFAULT 'sent',
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);
```

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/Rishab-Kumar09/ChatGenius-New.git
cd ChatGenius-New
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with:
```env
PORT=5000
NODE_ENV=development
SESSION_SECRET=your_session_secret
```

4. Initialize the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`.

## Development Workflow

1. **Frontend Development**
   - Components are in `client/src/components`
   - Pages are in `client/src/pages`
   - Hooks and utilities in `client/src/lib`
   - Styles using Tailwind CSS

2. **Backend Development**
   - Routes are in `server/routes.ts`
   - Database schema in `db/schema.ts`
   - Authentication in `server/auth.ts`
   - File uploads handled by Multer

3. **Database Changes**
   - Edit schema in `db/schema.ts`
   - Run `npm run db:push` to apply changes
   - Seed data in `db/seed.ts`

## Security Considerations

1. **Authentication**
   - Session-based authentication
   - Password hashing with crypto module
   - CSRF protection via same-origin policy
   - Secure session cookies in production

2. **File Uploads**
   - Size limits (5MB max)
   - Type validation for images
   - Sanitized filenames
   - Secure storage path

3. **API Security**
   - Rate limiting on auth endpoints
   - Input validation with Zod
   - SQL injection protection via Drizzle
   - XSS prevention with React

## Troubleshooting

1. **Common Issues**
   - Database connection errors: Check SQLite file permissions
   - Avatar upload fails: Verify uploads directory exists
   - SSE disconnects: Check client timeout settings

2. **Development Tools**
   - React DevTools for component debugging
   - Network tab for API requests
   - SQLite browser for database inspection

## Contributing

Feel free to contribute to this project:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

ChatGenius is developed by [Rishab Kumar](https://github.com/Rishab-Kumar09).