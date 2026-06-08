# Proposal: Web CORS Proxy Bypass via User-Hosted Cloudflare Workers

## Background & Problem
For the Desktop app (**stage-tamagotchi**), CORS restrictions are bypassed natively at the Electron session layer by intercepting responses and injecting permissive access control headers.
However, for the Web app (**stage-web**), we do not have Electron main-process interception. If a user runs the web client and tries to use standard CORS-restrictive endpoints (such as Deepgram, Pioneer, or Opencode), their browser will block the XHR/fetch requests due to missing CORS response headers from the providers.

To solve this for Web users without introducing a centralized, privacy-compromising proxy server (which would expose users' private API keys and chat history to the host), we can allow users to host their own secure, free CORS proxy on Cloudflare Workers or Deno Deploy.

---

## Proposed Design: Settings > System > Connection

We will add a new configuration section right next to the existing **CORS Bypass URLs** list:

### 1. The Deployment Button
* Provide a **"Deploy to Cloudflare Workers"** button directly in the UI.
* This button will open a browser tab pointing to the Cloudflare template deployer (`https://deploy.workers.cloudflare.com/?url=...`), automatically setting up a private reverse proxy inside the user's free Cloudflare account using our repository template.

### 2. Custom Worker URL Configuration
* Introduce a new input field: **CORS Proxy Worker URL** (e.g., `https://my-cors-proxy.my-subdomain.workers.dev/`).
* A checkbox or toggle: **Enable CORS Proxy Worker for Web stage**.

### 3. Routing Mechanism
* When the proxy worker URL is configured:
  1. Any network request made by the renderer (e.g., fetch calls to providers) will check if the target destination matches any wildcard pattern in the **CORS Bypass URLs** list (e.g., `https://pioneer.ai/*`).
  2. If a match is found:
     * Instead of requesting `https://pioneer.ai/v1/chat/completions` directly, the client re-routes the request through their worker:
       `https://my-cors-proxy.my-subdomain.workers.dev/https://pioneer.ai/v1/chat/completions`
     * The private worker fetches the real destination, strips headers like `CF-` and IP tracking headers, appends permissive wildcard CORS headers, and streams the response back to the client.
  3. If no match is found, the request proceeds directly to the destination.

---

## Benefits
* **High Privacy**: User API keys and conversation bodies are never exposed to any third party—they stay entirely within the user's own private Cloudflare account namespace.
* **Unified Client Configuration**: Desktop users can continue using the fast, local Electron interceptor, while Web stage users can seamlessly toggle the Cloudflare Worker fallback to bypass the exact same list of domains.
* **No Server Costs**: Bypasses the need for Moeru AI to host, scale, or pay for proxy servers.
