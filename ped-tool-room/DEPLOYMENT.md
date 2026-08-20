# Deploying PED Tool Room on Your Office Network

This app currently runs on `localhost`, which only your own machine can see.
This guide explains how to host it on one machine on your network so
**everyone in the office can reach it from their own computer**, using their
browser, at an address like `http://ped-tools:3000` or
`http://192.168.1.50:3000`.

---

## 0. Quick option: sharing a link straight from VS Code (no server setup)

If you just want teammates to try it out **right now** — before setting up a
dedicated server — VS Code has a built-in feature for this called **Dev
Tunnels** (previously called Port Forwarding). It gives you a real internet
URL that tunnels back to your own machine while your dev server is running.

**Steps:**
1. In VS Code, run `npm run dev` in the integrated terminal as usual.
2. Open the **Ports** tab (next to the Terminal tab at the bottom panel — if
   you don't see it, `Ctrl+Shift+P` → type "Ports: Focus on Ports View").
3. Click **Forward a Port**, enter `3000`, press Enter.
4. Right-click the new row → **Port Visibility → Public**.
5. VS Code shows a URL like `https://abcd1234-3000.inc1.devtunnels.ms` —
   send that to your teammates. It works from anywhere with internet, not
   just your office network.

**Important limitations of this approach — use it for a quick demo only, not
daily use:**
- The link only works while **your VS Code window stays open** and your
  computer stays on and connected.
- Every time you restart `npm run dev`, if the tunnel resets you may need to
  re-share a new link (usually the same one persists per-workspace, but don't
  rely on it).
- It goes through Microsoft's Dev Tunnels relay service, so it's not the
  right choice for handling sensitive company data long-term.

**For anything beyond a quick demo, use one of the proper options below** —
they give you a stable link that works whether or not your own laptop is on,
and keep the data on your own network rather than routing through a third
party.

---

## 0.5. Even simpler, if you're all on the same office Wi-Fi/network already

You don't actually need VS Code tunnels *or* a separate server just to let
office teammates on the same network reach the app running on your own PC —
Next.js already listens on all network interfaces by default.

**Steps:**
1. Find your computer's local network IP address:
   - **Windows:** open PowerShell, run `ipconfig`, look for "IPv4 Address"
     (something like `192.168.1.45`)
   - **Mac/Linux:** run `ifconfig` or `ip addr`, look for a similar
     `192.168.x.x` address
2. Make sure the app is running: `npm run dev` (or `npm run build && npm run start` for a more stable version)
3. Share this link with teammates **on the same office Wi-Fi/network**:
   ```
   http://192.168.1.45:3000
   ```
   (using your actual IP from step 1)
4. You may need to allow the connection through Windows Firewall the first
   time — Windows usually pops up a prompt asking to allow Node.js on
   "Private networks"; click **Allow**.

**Limitations:** only works while your computer is on and the app is
running, and only for people physically on the same office network (not
useful for remote/work-from-home teammates — for that, use the VS Code
tunnel above for a quick demo, or a real server deployment for daily use).

This is the best middle ground between "just for me" and "a real server" —
no new software to install, works for anyone in the building, and doesn't
depend on your VS Code window staying open like the tunnel option does.

---

## 1. What this app needs from a server

Before comparing options, it helps to know what's actually running:

- It's a **Node.js application** (Next.js). The server needs Node.js installed
  — the same requirement as your own machine.
- It uses **SQLite** — a single file on disk (`data/ped-tool-room.db`), read
  and written through Node's own built-in `node:sqlite` module. This means:
  - ✅ No separate database server to install or manage.
  - ✅ No native module to compile — nothing but Node.js is required on the
    server, so `npm install` works on a bare machine.
  - ✅ Backups are as simple as copying one file.
  - ⚠️ The app must run as a **long-lived Node process on a real disk** — not
    on "serverless" hosting (e.g. plain Vercel), where the filesystem resets
    between requests and your data would disappear.
- It needs one **fixed port** open (default `3000`) on the server's firewall
  so other computers can reach it.

This rules out serverless cloud hosting for this version, and points
squarely at **"run it on a machine that stays on"** — which is exactly what
an office network deployment is.

---

## 2. Comparing your options

| Option | Good fit if… | Effort | Notes |
|---|---|---|---|
| **Windows Server / Windows PC + PM2** | Your office already runs Windows Server, or you'll dedicate an always-on Windows PC | Low | Simplest path if your IT is Windows-based. No IIS complexity required. |
| **Windows Server + IIS (reverse proxy)** | You specifically want it served through IIS (e.g. company standard, need IIS-level logging/auth) | Medium | IIS doesn't run Node.js directly — it proxies to a Node process via **iisnode** or **ARR (Application Request Routing)**. More moving parts. |
| **Linux server (Ubuntu/Debian) + PM2 + Nginx** | You have or can spin up a small Linux VM (even a spare PC) | Low–Medium | Very common, well-documented, lightweight. Recommended if Linux is an option at all. |
| **Docker** | You want a fully reproducible, containerized deployment | Medium | Works cleanly — the app is pure JavaScript on top of Node, so any `node:22`-or-newer base image will do, on any architecture. Mount `data/` as a volume so the database survives container updates. |

**Recommendation:** if you have *any* choice in the matter, **Linux + PM2 (+ optional Nginx)** is the least fiddly and most battle-tested path for a small internal Node app. If your environment is Windows-only, **Windows + PM2** (skipping IIS) is the simplest equivalent. Full steps for both are below. IIS and Docker steps are included afterward for completeness since you asked about them.

---

## 3. Recommended: Linux Server + PM2 + Nginx

### Step 1 — Get a machine
Any always-on Linux machine on your office network: a spare PC, a VM, or a
small server. Ubuntu Server 22.04/24.04 LTS is a safe choice.

### Step 2 — Install Node.js (LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Node.js **22.5 or newer** is required — that's the version that ships the
built-in SQLite support the app uses. Nothing else needs installing: there is
no native module to compile, so no `build-essential`, no Python, no toolchain.

### Step 3 — Copy the project to the server
From your own machine:
```bash
scp -r ped-tool-room your-user@server-ip:/opt/ped-tool-room
```
(Or `git clone` if you put it in a private repo, or just copy the zip over and unzip it there.)

### Step 4 — Install dependencies and build
```bash
cd /opt/ped-tool-room
npm install
cp .env.example .env.local
nano .env.local   # set JWT_SECRET and SMTP_* values — see section 5 below
npm run build
```

### Step 5 — Run it with PM2 (keeps it running, restarts on crash/reboot)
```bash
sudo npm install -g pm2
pm2 start npm --name "ped-tool-room" -- start
pm2 save
pm2 startup      # follow the printed instructions to enable auto-start on boot
```
By default `next start` listens on port 3000 on all network interfaces, so
it's already reachable from other computers at `http://<server-ip>:3000`.

### Step 6 — Open the firewall port
```bash
sudo ufw allow 3000/tcp
```

### Step 7 (optional but recommended) — Put Nginx in front
This lets you use a friendly URL like `http://ped-tools` instead of
`http://192.168.1.50:3000`, and makes it easy to add HTTPS later.

```bash
sudo apt-get install -y nginx
```
Create `/etc/nginx/sites-available/ped-tool-room`:
```nginx
server {
    listen 80;
    server_name ped-tools;  # or the server's hostname/IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/ped-tool-room /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 'Nginx Full'
```
Then add a DNS entry (or an entry in each PC's `hosts` file, or your office
router's local DNS) pointing `ped-tools` → the server's IP, and everyone can
open `http://ped-tools` instead of typing an IP address.

### Step 8 — Everyone else connects
From any computer on the same office network/Wi-Fi, open a browser to:
```
http://<server-ip>:3000
```
or, if you set up Nginx + DNS:
```
http://ped-tools
```

---

## 4. Equivalent: Windows Server / Windows PC + PM2 (no IIS)

### Step 1 — Install Node.js
Download the **LTS** installer from https://nodejs.org and run it (same as
on your own machine).

### Step 2 — Nothing else to install
There is no second step here any more. The app has no native dependencies, so
Visual Studio Build Tools, the C++ workload and Python are **not** needed —
`npm install` runs on a plain Windows PC with only Node.js on it. Just make
sure the Node version is **22.5 or newer** (`node -v`).

### Step 3 — Copy the project onto the server
Copy the `ped-tool-room` folder onto the Windows machine (USB drive, network
share, or `robocopy` over the network).

### Step 4 — Install, configure, build
Open PowerShell **as Administrator** in the project folder:
```powershell
npm install
npm run build
```
The first run creates `.env.local` with a random session secret. If you want
email notifications, open it and fill in the `SMTP_*` values:
```powershell
notepad .env.local
```

### Step 5 — Run it as a background service with PM2
```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
pm2 start npm --name "ped-tool-room" -- start
pm2 save
```
This keeps the app running in the background and restarts it automatically
if the server reboots.

### Step 6 — Open the firewall port
```powershell
New-NetFirewallRule -DisplayName "PED Tool Room" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

### Step 7 — Everyone else connects
```
http://<server-ip>:3000
```
To get a friendly name like `http://ped-tools`, add a DNS "A" record on your
office's DNS server (or Windows Server's DNS role) pointing to that machine's
IP, or add it to each PC's `hosts` file as a stopgap.

---

## 5. If your company specifically wants IIS

IIS itself can't run Node.js apps directly — it needs to hand requests off to
the Node process. Two ways to do that:

**Option A — IIS as a reverse proxy (simpler, recommended if IIS is required)**
1. Run the app with PM2 exactly as in Section 4 (it'll be listening on
   `127.0.0.1:3000`).
2. On the IIS server, install the **URL Rewrite** and **Application Request
   Routing (ARR)** modules from the IIS extensions page.
3. Create a new website in IIS bound to port 80 (or your chosen port).
4. Add a URL Rewrite rule that proxies all requests to
   `http://127.0.0.1:3000/{R:1}`.
5. IIS now fronts the app; PM2 keeps the actual app alive behind it.

**Option B — iisnode (runs Node directly inside IIS's worker process)**
More invasive to set up and less commonly used with modern Next.js apps —
Option A is recommended instead unless you have a specific reason to need
iisnode.

---

## 6. Docker (if you want a container)

The app is pure JavaScript running on Node, with no compiled dependencies, so
any `node:22`-or-newer base image works on any architecture — there is no
"build it on the same platform you deploy to" caveat to worry about.

A `Dockerfile` is not included by default in this build (per your request to
keep scope to the three features above), but the shape of it is
straightforward — happy to add one in a follow-up if you decide to go this
route; it's a small addition (multi-stage build: `npm install` → `npm run
build` → copy into a slim Node runtime image, mount `/app/data` as a volume
so the SQLite file survives container restarts/updates).

---

## 7. Before you deploy: production checklist

1. **Set a real `JWT_SECRET`** in `.env.local` — don't ship the placeholder.
   Generate one with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Set SMTP credentials** in `.env.local` if you want email notifications
   to actually send (see the Email Notifications section of the README).
   Until configured, the app safely logs emails instead of sending them —
   nothing breaks, but no one receives anything either.
3. **Change the default account passwords** (`admin123`, `owner123`,
   `monitor123`) via User Management before real people start using it.
4. **Back up `data/ped-tool-room.db` regularly** — that file is your entire
   database. A nightly copy to another drive or network share is enough for
   most small deployments.
5. **Use `npm run build && npm start`** in production, not `npm run dev`.
   `next start` is faster and more stable for real use; `next dev` is only
   for local development.

---

## 8. Updating the app later

When you make changes (new features, fixes):
```bash
# On the server, after copying the updated code over:
cd /opt/ped-tool-room          # or wherever it lives
npm install                     # only needed if dependencies changed
npm run build
pm2 restart ped-tool-room
```
Your data in `data/ped-tool-room.db` is untouched by this process — it lives
outside the application code.
