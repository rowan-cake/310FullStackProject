import { createApp } from "../src/App";

const appPromise = createApp({
  datadir: process.env.DATA_DIR || "/tmp/insightubc-data",
});

export default async function handler(req: any, res: any): Promise<void> {
  const app = await appPromise;
  app(req, res);
}
