# Chat App

A real-time messaging web app with one-to-one chats, group chats, and group management — built with React, Node.js, Express, PostgreSQL, and Socket.io.

## Features

- User authentication (signup/login with JWT)
- One-to-one real-time messaging
- Group creation, joining, and leaving
- Group messaging in real-time
- Online/offline status
- Typing indicators
- Delete for me / Delete for everyone
- Group member management (add/remove members, admin auto-transfer)
- Responsive design with Tailwind CSS

## Tech Stack

**Frontend:** React (Vite), Tailwind CSS, Socket.io Client, Axios, React Router
**Backend:** Node.js, Express, Socket.io, PostgreSQL (pg), JWT, bcrypt

## Project Structure

chat-app/
├── backend/ # Express API + Socket.io server
└── frontend/ # React (Vite) client

## Setup

### Backend

```bash
cd backend
npm install
# Create a .env file (see .env.example)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Backend (`backend/.env`)

DATABASE_URL=your_postgres_connection_string
JWT_SECRET=your_secret_key
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

### Frontend (`frontend/.env`)

VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
