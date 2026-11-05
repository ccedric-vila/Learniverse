# Learniverse

## Install

From the project root, install dependencies for both the backend and frontend:

```sh
npm i
```

Copy `backend/.env.example` to `backend/.env` and fill in your own database,
Cloudinary, and JWT settings. Copy `frontend/.env.example` to
`frontend/.env` if you need to change the API URL. Do not commit `.env` files.

## Run

Start the backend and frontend in separate terminals from the project root:

```sh
npm start --workspace backend
```

```sh
npm run dev --workspace frontend
```

## Google sign-in and verified registration

Email/password registration sends a six-digit verification code before a student
account is created. Codes expire after 10 minutes, can be resent after 60
seconds, and are limited to five verification attempts. Google sign-in creates
or signs in student accounts only; professor and admin accounts remain
provisioned separately.

Configure these backend environment variables in Render and in local
`backend/.env`:

- `GOOGLE_CLIENT_ID`: the OAuth 2.0 Web application client ID from Google
  Cloud. Google ID tokens are verified by the backend against this audience.
- `RESEND_API_KEY`: a Resend API key. Keep it private.
- `RESEND_FROM`: a sender address on a domain verified with Resend, such as
  `Learniverse <no-reply@example.com>`.

Configure `VITE_GOOGLE_CLIENT_ID` in Vercel and local `frontend/.env` with the
same Google Web application client ID. This client ID is public; do not put
`RESEND_API_KEY` in frontend variables.

In Google Cloud Console, configure the OAuth consent screen and create an OAuth
client with application type **Web application**. Add the deployed Vercel
domain and `http://localhost:5173` as authorized JavaScript origins. No
redirect URI is required for the popup-based sign-in. Verify the Resend sender
domain before testing email registration. Redeploy the backend after setting
its variables and rebuild/redeploy the frontend after setting its `VITE_`
variable.
