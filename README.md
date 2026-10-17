# ⚡ FOCENTRA
### Focus better. Study smarter. Achieve more.

<p align="center">
  <img src="https://img.shields.io/badge/FOCENTRA-Focus%20Your%20Potential-7C5CFC?style=for-the-badge&logo=target&logoColor=white" alt="FOCENTRA" />
  <img src="https://img.shields.io/badge/React-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React and TypeScript" />
  <img src="https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
</p>

<p align="center">
  <strong>Your space to focus, connect, and grow.</strong>
  <br />
  A modern study productivity platform designed to help students stay focused, track progress, and build better study habits together.
</p>

---

## ✨ About FOCENTRA

Studying isn't just about putting in hours — it's about making those hours count.

**FOCENTRA** is a study productivity platform built to bring focus sessions, goals, progress tracking, leaderboards, and collaborative study groups into one place.

Whether you're preparing for competitive exams, working toward academic goals, or simply trying to build a consistent routine, FOCENTRA helps make every study session more purposeful.

## 🚀 Features

| Feature | Description |
|---|---|
| ⏱️ **Focus Timer** | Stay on track with dedicated study sessions and monitor your focused time. |
| 🎯 **Study Goals** | Create goals, organize your targets, and keep your progress moving. |
| 🏆 **Leaderboard** | Compare study progress and stay motivated through friendly competition. |
| 👥 **Study Groups** | Find communities for JEE, NEET, CBSE, ICSE, college, and other learning paths. |
| 👤 **User Profiles** | Keep your personal study identity and progress organized. |
| 🔐 **Authentication** | Sign in and manage your account through Supabase authentication. |
| 🌙 **Dark UI** | A modern, dark-themed interface designed for a focused experience. |

## 🛠️ Tech Stack

<p>
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/Lucide_Icons-F56565?style=flat-square" alt="Lucide icons" />
</p>

- **Frontend:** React + TypeScript
- **Build tool:** Vite
- **Backend and database:** Supabase
- **Styling:** CSS
- **Icons:** Lucide React

## 💻 Getting Started

Want to run FOCENTRA locally? Follow these steps.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/) — preferably an LTS release
- npm
- A [Supabase](https://supabase.com/) project with the required database schema and configuration

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd FOCENTRA
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your repository's actual Git URL.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project's root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace the placeholder values with the appropriate values from your Supabase project settings.

**Security:** Never commit `.env.local` or expose your Supabase `service_role` key in frontend code. Use appropriate Supabase Row Level Security (RLS) policies to protect user data.

### 4. Start the development server

```bash
npm run dev
```

Open the local URL printed in your terminal, usually `http://localhost:5173`.

### 5. Build for production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## 🌐 Deployment

FOCENTRA can be deployed using platforms that support React and Vite, such as [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).

For Vercel:

1. Import your GitHub repository.
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project's environment variables.
3. Use `npm run build` as the build command.
4. Set `dist` as the output directory.
5. Deploy your application.

Make sure your Supabase authentication settings include the appropriate production site URL and redirect URLs.

## 🔮 Vision

FOCENTRA aims to make studying feel less isolated and more intentional — combining personal discipline with the motivation that comes from learning alongside others.

The goal is simple: **help students turn focused time into meaningful progress.**

## 🤝 Contributing

Suggestions, bug reports, and improvements are welcome.

1. Fork the repository.
2. Create a branch for your change.
3. Commit your updates.
4. Open a pull request describing your contribution.

## 🔒 Security

If you discover a security issue, avoid posting credentials, tokens, or sensitive user information publicly. Report the issue privately to the repository owner.

## 📄 License

No license has been specified yet. Unless a license is added to this repository, reuse and redistribution are not automatically permitted.

---

<p align="center">
  <strong>⚡ FOCENTRA — Make every focused minute count.</strong>
  <br />
  Built for better habits, stronger focus, and smarter studying.
</p>
