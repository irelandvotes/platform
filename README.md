This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Staff X publishing

The polling graphic editor can publish its generated PNG and post text to X through the X API. Configure an X Developer App with OAuth 2.0 Authorization Code with PKCE, a Web App client, and these callback URLs:

- Local: `http://localhost:3000/api/staff/x/callback`
- Production: `https://YOUR_DOMAIN/api/staff/x/callback`

Grant the app `tweet.write`, `users.read`, `media.write`, and `offline.access`. X requires the callback URL to match the app configuration exactly and the X account to authorize the app before posting.

Set these server-side environment variables in `.env.local` for local development and in Vercel for the environments where staff will post:

```env
X_CLIENT_ID=your-x-oauth-client-id
X_CLIENT_SECRET=your-x-oauth-client-secret
X_TOKEN_ENCRYPTION_KEY=generate-a-private-random-key
```

Generate the encryption key locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Keep all three values private and do not add them to `NEXT_PUBLIC_*` variables. After setting them, restart the local server or redeploy Vercel, open the graphic creator, choose **Generate post**, and connect the Ireland Votes X account.
