# GitHub Pages Remote Authentication Portal for Local Share

This folder contains the standalone Password Access Page that you can host for FREE on GitHub Pages.

## 🚀 Quick Setup Instructions (2 Minutes)

### Option A: Create a New GitHub Repository
1. Create a new public repository on GitHub named `local-share-access` (or any name you prefer).
2. Upload `index.html` from this `github-pages` folder to your new GitHub repository.
3. In your GitHub repository, go to **Settings** > **Pages**.
4. Under **Build and deployment** > **Branch**, select `main` (or `master`) and click **Save**.
5. GitHub Pages will generate your public URL:
   `https://<your-username>.github.io/local-share-access/`

### Option B: Deploy within this repository
If your main project is pushed to GitHub, go to **Settings** > **Pages**, choose your branch and select `/github-pages` folder (or push this folder's content to `gh-pages` branch).

---

## 🔒 How It Works

1. Open your GitHub Pages link on any phone, tablet, or external computer.
2. Enter your **Ngrok URL** (e.g., `https://xxxx.ngrok-free.app`) and your **Password**.
3. The page sends a request to your local PC via Ngrok to verify your password against the Bcrypt hash stored in `.env`.
4. Once verified, it redirects you straight to your Local Share app with an access token!
