# SecDev - Secure Full-Stack University Project

SecDev is a small full-stack web platform built for a Secure App Design course. It includes user registration/login/logout, profile management, discussion posts/comments, file sharing, and a VirusTotal-backed file scanner.

The project is intentionally security-focused: the code demonstrates authentication, input validation, password hashing, cookie-based sessions, rate limiting, origin checks, safe upload handling, and a short security analysis report.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Axios |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL via `pg` |
| Auth | JWT in httpOnly cookies |
| Upload | multer, magic-byte validation, VirusTotal, Cloudinary |
| Security | helmet, cors, express-rate-limit, origin guard |

## Required Pages

- Register / Login: account creation, sign in, logout
- Profile Management: profile update, avatar upload, password change
- Threads: public message and file threads with comments
- DM Inbox: private one-to-one messages between authenticated users
- File Sharing: upload, list, preview/download after clean scan inside Threads
- File Scanner: standalone VirusTotal scan workflow

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Required backend environment variables:

```env
PORT=4000
JWT_SECRET=replace_with_a_long_random_secret_minimum_32_characters
NODE_ENV=development
DATABASE_URL=postgresql://username:password@hostname/dbname
VIRUSTOTAL_API_KEY=your_virustotal_api_key_here
FRONTEND_ORIGIN=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

The API runs on `http://localhost:4000`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend runs on `http://localhost:5173`.

## API Summary

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Register a new account |
| POST | `/api/auth/login` | No | Login and set auth cookie |
| POST | `/api/auth/logout` | No | Clear auth cookie |
| GET | `/api/users/me` | Yes | Current user profile |
| PATCH | `/api/users/me` | Yes | Update username/email |
| POST | `/api/users/me/password` | Yes | Change password |
| POST | `/api/users/me/avatar` | Yes | Upload avatar |
| GET | `/api/users` | Yes | List users for private messages |
| GET/POST | `/api/threads` | Yes | List/create public message or file threads |
| GET/POST | `/api/threads/:type/:id/comments` | Yes | List/create comments for a public thread |
| GET/POST | `/api/dms` | Yes | List/create private one-to-one conversations |
| GET/POST | `/api/dms/:id/messages` | Yes | Read/reply to private messages |
| GET/POST | `/api/messages` | Yes | List/create posts |
| GET/POST | `/api/messages/:id/comments` | Yes | List/create comments |
| GET/POST | `/api/files` | Yes | List/upload shared files |
| GET | `/api/files/:id/view` | Yes | Preview clean files |
| GET | `/api/files/:id/download` | Yes | Download clean files |
| POST | `/api/scan/file` | Yes | Standalone VirusTotal scan |

## Security Design

- Passwords are hashed with bcrypt cost factor 12.
- JWTs are stored in httpOnly cookies, not localStorage.
- Password changes increment `password_version`, invalidating old sessions.
- `FRONTEND_ORIGIN` is enforced for unsafe methods to reduce CSRF risk.
- SQL uses parameterized queries.
- Register/login/profile inputs are validated server-side.
- Helmet adds defensive HTTP headers.
- CORS is restricted to the configured frontend origin.
- Rate limiting is applied to auth, upload, and general API routes.
- Avatar uploads enforce extension, MIME, size, and magic-byte checks, then store accepted images in Cloudinary.
- Shared file uploads fail closed when VirusTotal is unavailable or not configured.
- Shared files cannot be previewed or downloaded while scan status is pending or rejected.
- Shared file bytes are stored in Cloudinary; PostgreSQL stores metadata and Cloudinary public IDs.
- Real secrets, database files, uploads, build output, and dependencies are ignored by Git.

## Validation Commands

```bash
cd backend
npm run build
npm test
npm audit --audit-level=moderate

cd ../frontend
npm run build
npm run lint
npm audit --audit-level=moderate
```

## Security Analysis Report

The course report is in `docs/security-analysis.md`.
