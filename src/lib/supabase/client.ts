import { createBrowserClient } from "@supabase/ssr";

/**
 * The Supabase client for Client Components.
 *
 * Carries the publishable key and whatever session cookie the browser holds,
 * so it can do only what that signed-in user is allowed to do. Most reads
 * happen in Server Components instead; this is for the few places that
 * genuinely need to talk to the database from the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
