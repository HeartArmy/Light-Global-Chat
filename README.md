
# 🌐 Global Live Chat Room

A **real-time global chat room application** with a beautiful, minimalist design philosophy. Connect instantly with users worldwide without any sign-up process.

## 🚀 Try It Live

Try the app now on any of these live instances:

- **Primary:** https://globalchatroom.vercel.app/


## ✨ Features

* **🌐 Real-time Messaging**: Instant message delivery using **Pusher WebSocket** for a seamless experience.
* **🎨 Dark/Light Themes**: Seamless theme switching that respects system preference detection.
* **👤 No Authentication Required**: Join instantly with just a **display name**.
* **🌍 Country Flags**: Automatic country detection from the user's IP address.
* **💬 Rich Messaging**: Supports text, links, **images**, and **file attachments**.
* **↩️ Reply Threading**: Reply to specific messages with context.
* **😊 Emoji Reactions**: Quick reactions and an extended emoji palette.
* **✏️ Edit/Delete**: Edit or delete your messages within a **10-minute window**.
* **📱 Mobile-First**: Optimized with touch gestures, responsive design, and tailored for all devices.
* **⚡ Fast & Lightweight**: Optimized bundle size, code splitting, and lazy loading for top-tier performance.

---

## 🛠️ Tech Stack

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14** (App Router), React 18, TypeScript | Modern, performant front-end framework. |
| **Styling** | **Tailwind CSS** | Utility-first CSS framework with a custom design system. |
| **Real-time** | **Pusher Channels** (WebSocket) | Core service for instant, bi-directional communication. |
| **Database** | **MongoDB** with Mongoose ODM | Flexible, scalable NoSQL data storage. |
| **File Storage** | **UploadThing** | Secure and easy-to-use file upload handling. |
| **Deployment** | **Vercel** | Optimized hosting for Next.js applications. |

---

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

Ensure you have the following services and tools configured:

* **Node.js** 18+ and npm
* **MongoDB** database (MongoDB Atlas recommended)
* **Pusher** account and app credentials
* **UploadThing** account credentials

### Environment Variables

Create a file named `.env.local` in the root directory and populate it with your service keys:

```env
# MongoDB
MONGODB_URI=your_mongodb_uri

# Pusher
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster

# UploadThing
UPLOADTHING_SECRET=your_uploadthing_secret
UPLOADTHING_APP_ID=your_uploadthing_app_id
UPLOADTHING_TOKEN=your_uploadthing_token

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
````

### Installation

1.  Clone the repository and navigate into the project directory:

    ```bash
    git clone [YOUR_REPO_URL]
    cd Global-Live-Room
    ```

2.  Install the project dependencies:

    ```bash
    npm install
    ```

3.  Run the development server:

    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) in your browser to view the application.

### Build for Production

To create a production-ready build:

```bash
npm run build
npm start
```

-----

## ☁️ Deployment to Vercel

The app is optimized for deployment on Vercel.

1.  Push your code to a Git repository (GitHub, GitLab, or Bitbucket).
2.  Import your repository into a new project on the Vercel dashboard.
3.  **Configure Environment Variables**:
      * Go to **Project Settings** → **Environment Variables**.
      * Add all variables from your `.env.local` file.
4.  **Deploy\!** The app will automatically deploy on every push to your main branch.

-----

## 📂 Project Structure

A high-level overview of the project directory:

```
├── app/                      # Application core (Next.js App Router)
│   ├── api/                  # API routes (Country, Messages, Uploads)
│   ├── layout.tsx            # Root layout component
│   ├── page.tsx              # Main chat room component
│   └── globals.css           # Global styles
├── components/               # Reusable React components
│   ├── MessageInput.tsx      # Chat input and attachment handler
│   └── ThemeProvider.tsx     # Context for theme switching
├── lib/                      # Utility functions and configuration
│   ├── mongodb.ts            # Database connection logic
│   ├── pusher.ts             # Pusher client/server instances
│   └── utils.ts              # General utilities
├── models/                   # Database schemas (Mongoose models)
│   └── Message.ts
├── types/                    # TypeScript interfaces and types
└── proxy.ts             # Next.js middleware for IP-based logic
```

-----

## 🔍 Features in Detail

### Security Best Practices

The application incorporates several measures to ensure a secure environment:

  * **Input Sanitization** to prevent **XSS attacks**.
  * **Rate Limiting** (10 requests per minute per IP) on critical endpoints.
  * **File Validation** for type and size restrictions.
  * Proper **CORS** configuration and essential **Security Headers**.

### Mobile Optimizations

The chat is built for a superior mobile experience:

  * **Touch Gestures**: Swipe right to reply, long press for actions.
  * **Adaptive Layout** from 320px to 2560px.
  * **Accessibility**: 44px minimum tap targets.
  * Native file picker and virtual keyboard handling.

### Browser Support

The application is tested and fully compatible with modern browsers:

  * Chrome (latest)
  * Firefox (latest)
  * Safari (latest)
  * Edge (latest)
  * iOS Safari
  * Android Chrome

-----

## 🤝 Contributing

Contributions are always welcome\! If you find a bug or have a feature suggestion, please feel free to submit a **Pull Request** or open an **Issue**.

-----

## 📄 License

Distributed under the **MIT License**. See the `LICENSE` file for more information.
