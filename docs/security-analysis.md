# Security Analysis Report

## Application Context

SecDev is a small authenticated web platform with profile management, discussion posts/comments, file sharing, and VirusTotal-backed file scanning. The application is designed for a Secure App Design course, so the main goal is to demonstrate common web security risks and concrete defensive controls.

## Main Security Risks

- SQL injection: attackers may try to inject SQL through login, registration, profile, post, comment, or file metadata fields.
- Cross-site scripting: attackers may submit HTML or JavaScript inside posts, comments, usernames, file titles, or file descriptions.
- Credential attacks: attackers may brute-force login attempts or reuse weak passwords.
- Session theft or session misuse: attackers may attempt to steal JWTs, reuse expired tokens, or keep using old sessions after password changes.
- CSRF: because authentication uses cookies, a malicious site may try to trigger state-changing requests from the user's browser.
- Malicious file upload: attackers may upload executable files, spoof MIME types, upload files with misleading extensions, or share malware.
- IDOR and authorization bypass: attackers may try to delete another user's posts, comments, or files by changing URL IDs.
- Dependency vulnerabilities: vulnerable npm packages may introduce exploitable code paths.
- Secret leakage: `.env` files, database files, uploaded files, or build artifacts may accidentally be committed.

## Security Measures Implemented

- SQL queries use parameterized placeholders instead of string-concatenated user input.
- Passwords are hashed with bcrypt using cost factor 12.
- JWTs are stored in httpOnly cookies, reducing exposure to JavaScript-based token theft.
- JWTs expire after 7 days.
- Password changes increment a `password_version` value, invalidating older sessions.
- Invalid or stale auth cookies are cleared by the backend.
- Unsafe HTTP methods are protected by an origin guard that checks `Origin` against `FRONTEND_ORIGIN`.
- CORS is restricted to the configured frontend origin and does not use wildcard origins.
- Helmet applies defensive HTTP headers, including frame, MIME-sniffing, and CSP-related protections.
- Rate limits are applied to authentication, uploads, and general API routes.
- Registration, login, profile, post, comment, and file metadata fields are validated server-side.
- React renders user-generated text as text, not with `dangerouslySetInnerHTML`.
- Avatar uploads enforce allowed image MIME types, extension blocklists, size limits, and image magic-byte validation.
- Shared file uploads block dangerous executable/script extensions.
- Image and PDF uploads are checked with magic bytes when applicable.
- Shared file uploads fail closed when VirusTotal is unavailable or not configured.
- Pending or rejected shared files cannot be previewed or downloaded.
- Delete operations verify resource ownership before deleting posts, comments, or files.
- Real secrets, local database files, uploaded content, dependencies, and build output are ignored by Git.
- Backend security behavior is covered by automated tests for origin checks, auth rejection, stale sessions, ownership, and upload rejection.

## Known Limitations

- File sharing is intentionally visible to all authenticated users. This is a product decision for the course demo, but it means uploaded content should not be treated as private.
- Uploaded files are stored on the backend filesystem. This is simple for a course project but not ideal for production; managed object storage would be better.
- VirusTotal is an external dependency. If it is unavailable, file sharing fails closed instead of accepting unscanned files.
- There is no admin moderation panel for removing abusive posts or files.
- There is no email verification or password reset flow.
- The CSRF defense uses strict origin checking. A production system could add a dedicated CSRF token for stronger defense in depth.
- The standalone scanner accepts files into memory up to 32 MB. This is acceptable for the demo but should be revisited for high-volume production use.

## Example Exploit Paths Considered

- SQL injection attempt: submitting `alice@example.com' OR '1'='1` during login. Parameterized queries treat it as a value, not SQL.
- Stored XSS attempt: posting `<script>alert(1)</script>` in a message. React escapes it and displays it as text.
- Brute-force attempt: repeated login requests from the same client. The auth rate limiter returns HTTP 429 after too many attempts.
- Stale session attempt: changing the password and reusing the old cookie. The backend compares `password_version` and rejects the old token.
- CSRF attempt: a malicious site submits a cross-origin POST. The backend rejects unsafe requests whose `Origin` is not the configured frontend origin.
- Malware upload attempt: uploading `bad.exe`. The file route rejects blocked extensions before scanning.
- MIME spoofing attempt: uploading a fake PDF with non-PDF bytes. The backend rejects it with a magic-byte validation error.
- IDOR delete attempt: user 1 sends `DELETE /api/messages/10` for a post owned by user 2. The backend checks ownership and returns 403.
