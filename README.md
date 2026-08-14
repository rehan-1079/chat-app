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

## Prerequisites

- [Node.js](https://nodejs.org) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/download/) installed and running locally

## Setup

### 1. Database Setup

Create a local PostgreSQL database:

```sql
CREATE DATABASE chatapp;
```

Then connect to it and run the following to create all tables:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
  id SERIAL PRIMARY KEY,
  group_id INT REFERENCES groups(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INT REFERENCES users(id) NOT NULL,
  receiver_id INT REFERENCES users(id),
  group_id INT REFERENCES groups(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (
    (receiver_id IS NOT NULL AND group_id IS NULL) OR
    (receiver_id IS NULL AND group_id IS NOT NULL)
  )
);

ALTER TABLE messages DROP CONSTRAINT messages_group_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

CREATE TABLE message_deletions (
  id SERIAL PRIMARY KEY,
  message_id INT REFERENCES messages(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatapp
JWT_SECRET=any_random_secret_string
PORT=5000

Start the backend:

```bash
npm run dev
```

The backend will run on `http://localhost:5000`.

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`.

### 4. Using the App

1. Open `http://localhost:5173` in your browser
2. Sign up for an account
3. Open a second browser (or an incognito window) and sign up with a different account to test real-time messaging and groups

## Notes

- Both the backend and frontend servers must be running at the same time for the app to work.
- This project is intended to run locally and has not been deployed.
