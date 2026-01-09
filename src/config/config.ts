export const SERVER_IP = process.env.SERVER_IP;
export const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

export async function resolveServerIP(timeoutMs = 500): Promise<string> {
  const candidates = ["localhost", "127.0.0.1"];

  if (process.env.EXPO_PUBLIC_SERVER_IP) {
    candidates.push(process.env.EXPO_PUBLIC_SERVER_IP);
  }

  const ping = async (host: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`http://${host}:8000`, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(id);
      return res.ok || (res.status >= 200 && res.status < 500);
    } catch {
      return false;
    }
  };

  for (const host of candidates) {
    if (await ping(host)) {
      console.log(`Backend reachable at ${host}:8000`);
      return host;
    }
  }

  if (process.env.EXPO_PUBLIC_SERVER_IP) {
    console.warn(
      `No local backend found on port 8000. Using SERVER_IP fallback: ${process.env.EXPO_PUBLIC_SERVER_IP}`
    );
    return process.env.EXPO_PUBLIC_SERVER_IP;
  }

  console.warn(
    "No backend reachable on port 8000. Falling back to 'localhost'"
  );
  return "localhost";
}
