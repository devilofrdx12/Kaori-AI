# How to set up GitHub Actions CD Email Notifications

To get the deployment success and failure emails sent to your inbox, you need to configure the sender email account in your GitHub repository.

The workflow is already set up to send emails *to* `[EMAIL_ADDRESS]`, but it needs an email account to send them *from*. Since it's configured for Gmail (`smtp.gmail.com`), the easiest way is to use a Gmail account (you can even use your `[EMAIL_ADDRESS]` account to send emails to itself).

Here is exactly how to set it up:

## 1. Generate a Gmail App Password
Because normal Gmail passwords won't work for security reasons, you need an "App Password":
1. Go to your Google Account management page (https://myaccount.google.com/).
2. Navigate to **Security** on the left menu.
3. Make sure **2-Step Verification** is turned ON (App Passwords won't work without it).
4. Go to **2-Step Verification** and scroll to the bottom to find **App Passwords** (or search for "App Passwords" in the search bar).
5. Give it a name like "GitHub Actions CD" and click **Create**.
6. Copy the 16-character password it gives you. (Keep it safe, it will only be shown once).

## 2. Add Secrets to your GitHub Repository
Now you need to put that email and app password into your GitHub repo so the action can use them:
1. Go to your Kaori AI repository on GitHub.
2. Click on **Settings** (the gear icon at the top).
3. On the left sidebar, scroll down to **Secrets and variables** and click **Actions**.
4. Click the green **New repository secret** button.
5. Add the **Username**:
   - **Name:** `MAIL_USERNAME`
   - **Secret:** Your full gmail address (e.g., `email@gmail.com`)
   - Click **Add secret**.
6. Add the **Password**:
   - Click **New repository secret** again.
   - **Name:** `MAIL_PASSWORD`
   - **Secret:** The 16-character App Password you generated in step 1 (no spaces).
   - Click **Add secret**.

Once those two secrets are saved, the next time you push code or trigger a deployment, GitHub Actions will use them to log into the SMTP server and send the success/failure emails directly to you!
