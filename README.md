# SecDev — Secure Full-Stack University Project

A full-stack web application demonstrating security-aware development. Features JWT authentication, bcrypt password hashing, and a hardened file upload pipeline with multi-layer validation.

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | React 19 + TypeScript + Vite            |
| Backend    | Node.js + Express + TypeScript          |
| Database   | SQLite via Node built-in `node:sqlite`  |
| Auth       | JWT (jsonwebtoken)                      |
| Upload     | multer + file-type (magic-byte check)   |
| Security   | helmet, cors, express-rate-limit        |

---

## Project Structure

```
secdev/
├── backend/
│   ├── src/
│   │   ├── controllers/    auth.controller.ts, user.controller.ts
│   │   ├── middleware/     auth, upload, validate
│   │   ├── routes/         auth.routes.ts, user.routes.ts
│   │   ├── db/             database.ts  (SQLite singleton)
│   │   ├── utils/          fileValidation.ts
│   │   ├── app.ts          Express app config
│   │   └── server.ts       HTTP server entry point
│   └── uploads/avatars/    Stored avatar files
└── frontend/
    └── src/
        ├── api/            Axios client
        ├── context/        AuthContext (JWT state)
        ├── pages/          Login, Register, Profile
        └── components/     ProtectedRoute
```

---

## Setup

### Prerequisites

- Node.js >= 22.5.0 (uses built-in `node:sqlite`)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set a strong JWT_SECRET (min 32 chars)
npm install
npm run dev
```

The API runs at **http://localhost:4000**.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at **http://localhost:5173**.

---

## API Reference

| Method | Endpoint                    | Auth | Description              |
|--------|-----------------------------|------|--------------------------|
| POST   | /api/auth/register          | No   | Register a new account   |
| POST   | /api/auth/login             | No   | Login and receive a JWT  |
| GET    | /api/users/me               | Yes  | Get current user profile |
| POST   | /api/users/me/avatar        | Yes  | Upload/replace avatar    |
| GET    | /uploads/avatars/:filename  | No   | Serve avatar image       |

---

## Environment Variables

```
PORT=4000
JWT_SECRET=<random string, minimum 32 characters>
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
```

---

## Security Architecture

### Password Storage
Passwords are hashed with **bcrypt at cost factor 12** before being stored. The plaintext password is never persisted. `bcrypt.compare` is used for login — a timing-safe comparison resistant to enumeration.

### JWT Authentication
Tokens are signed with a secret loaded exclusively from `process.env.JWT_SECRET`. The server rejects startup if the variable is missing. Tokens expire after 7 days.

### HTTP Security Headers
`helmet` sets:
- `X-Frame-Options: DENY` — clickjacking protection
- `X-Content-Type-Options: nosniff` — MIME-sniffing protection
- `Strict-Transport-Security` — HTTPS enforcement
- `Content-Security-Policy` defaults

### CORS
Responses include `Access-Control-Allow-Origin` locked to the frontend origin. Wildcard (`*`) is never used.

### Rate Limiting
`express-rate-limit` caps every `/api/*` path to **100 requests per 15-minute window**. Exceeding it returns HTTP 429.

### Request Body Size
`express.json({ limit: '50kb' })` rejects oversized payloads before they reach controller code.

### Input Validation
`express-validator` validates every register/login field. Errors are returned as a structured list; no raw DB or stack info is exposed.

### File Upload Security (multi-layer)

| Layer | Check |
|-------|-------|
| 1. Extension blocklist | `.exe .php .js .ts .html .svg .sh .bat .py` rejected before multer storage |
| 2. MIME type | multer fileFilter rejects non-image MIME types declared by the client |
| 3. File size | multer limits.fileSize = 2 MB; excess returns 413 |
| 4. Magic bytes | `file-type` reads the first 4 100 bytes and confirms the actual binary signature matches JPEG/PNG/WebP |
| 5. Safe filename | Original filename is discarded; a UUID + extension is assigned |
| 6. Isolated storage | Files land in `uploads/avatars/` only; directory listing is disabled |

---

## Manual Test Checklist

1. Register with valid data → account created, redirect to login
2. Register with duplicate email → 409 error shown
3. Register with weak password (< 8 chars) → validation error
4. Login with correct credentials → JWT stored, redirect to profile
5. Login with wrong password → 401 error shown
6. Access `/profile` without being logged in → redirect to `/login`
7. Profile page shows username, email, and avatar (or placeholder)
8. Upload a valid JPEG under 2 MB → avatar updates
9. Upload a PNG with `.exe` extension → 422 rejected
10. Upload a file > 2 MB → 413 rejected
11. Upload a `.jpg` file whose content is not a real image → 422 rejected (magic bytes)
12. Logout → token cleared, `/profile` redirects to `/login`
