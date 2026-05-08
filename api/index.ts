import { createApp } from "../src/App";

const appPromise = createApp({
  datadir: process.env.DATA_DIR || "/tmp/insightubc-data",
});

export default async function handler(req: any, res: any): Promise<void> {
  try {
    const app = await appPromise;
    await new Promise<void>((resolve, reject) => {
      app(req, res, (err: unknown) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });

      res.on("finish", resolve);
      res.on("error", reject);
    });
  } catch (err) {
    console.error("Vercel API handler failed", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
