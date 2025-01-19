# ChatGenius

ChatGenius is a modern real-time chat application designed for seamless team communication. Built with TypeScript and React, it offers a rich set of features for both direct messaging and channel-based conversations.

## Features

* 💬 Real-time messaging with Server-Sent Events (SSE)
* 👥 Public and private channels with member management
* 📝 Rich message formatting and file attachments
* 👤 User profiles with customizable avatars
* 🔍 Message search functionality
* 📱 Responsive design for desktop and mobile
* 🌙 Dark theme UI with modern aesthetics
* 🔒 Secure authentication system
* 🎯 Message reactions and replies
* 📎 File sharing with preview support
* 👋 User presence indicators
* 🔔 Real-time notifications

## Technical Stack

### Frontend
* **Framework**: React with TypeScript
* **Build Tool**: Vite
* **UI Components**: shadcn/ui + Tailwind CSS
* **State Management**: React Query
* **Real-time Updates**: Server-Sent Events (SSE)
* **Form Handling**: React Hook Form + Zod validation

### Backend
* **Server**: Express.js with TypeScript
* **Database**: SQLite with Drizzle ORM
* **Real-time**: SSE for push notifications
* **File Handling**: Multer for file uploads
* **Authentication**: Session-based with Passport.js
* **API Design**: RESTful architecture

## Key Features in Detail

### Messaging System
* Real-time message delivery
* Message reactions with emojis
* Reply threading support
* File attachments with previews
* Message edit and delete functionality

### Channel Management
* Create public/private channels
* Member count display
* Member list with roles
* Channel join/leave functionality
* Channel invitations system

### User Experience
* Sleek dark theme interface
* Responsive sidebar design
* Fixed message input with proper spacing
* Smooth scrolling with custom scrollbars
* Loading states and error handling

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

## Project Structure

```
ChatGenius/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utilities and helpers
│   │   ├── pages/        # Page components
│   │   └── styles/       # Global styles
├── server/                # Backend Express application
│   ├── routes.ts         # API routes
│   └── auth.ts           # Authentication logic
├── db/                   # Database configuration
│   └── schema.ts         # Drizzle schema
└── migrations/           # Database migrations
```

## Security Features

* Session-based authentication
* Password hashing
* CSRF protection
* Secure file upload handling
* Input validation
* XSS prevention

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Author

ChatGenius is developed by Rishab Kumar.