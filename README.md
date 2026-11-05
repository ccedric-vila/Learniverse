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
