import { test, expect, type APIRequestContext } from "@playwright/test";

const API_BASE = process.env.OBSCURA_E2E_API_URL ?? "http://127.0.0.1:4000";
const FIXTURE_ROOT = process.env.OBSCURA_E2E_LIBRARY_ROOT ?? "/app/apps/web/public/media/scenes";

async function ensureLibraryRoot(request: APIRequestContext) {
  const existing = await request.get(`${API_BASE}/libraries?scanVideos=true&enabled=true`);
  const existingJson = (await existing.json()) as { roots: Array<{ id: string; path: string }> };
  const match = existingJson.roots.find((root) => root.path === FIXTURE_ROOT);
  if (match) {
    return match;
  }

  const created = await request.post(`${API_BASE}/libraries`, {
    data: {
      path: FIXTURE_ROOT,
      label: "Fixture Scenes",
      enabled: true,
      recursive: true,
      scanVideos: true,
      scanImages: false,
      scanAudio: false,
    },
  });

  expect(created.ok()).toBeTruthy();
  return (await created.json()) as { id: string; path: string };
}

async function waitForScenes(request: APIRequestContext) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const response = await request.get(`${API_BASE}/scenes?limit=20`);
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      scenes: Array<{ id: string; title: string }>;
    };
    if (body.scenes.length > 0) {
      return body.scenes;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("Timed out waiting for fixture scenes to appear");
}

test("dashboard, scenes, scene detail, subtitles, and jobs are reachable", async ({
  page,
  request,
}) => {
  await ensureLibraryRoot(request);

  const scanResponse = await request.post(`${API_BASE}/jobs/queues/library-scan/run`);
  expect(scanResponse.ok()).toBeTruthy();

  const scenes = await waitForScenes(request);
  const firstScene = scenes[0]!;

  const subtitleUpload = await request.post(`${API_BASE}/scenes/${firstScene.id}/subtitles`, {
    multipart: {
      language: "en",
      label: "Fixture",
      file: {
        name: "fixture.ass",
        mimeType: "text/plain",
        buffer: Buffer.from(
          `[Script Info]
Title: Fixture

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,24,&H00FFFFFF,&H000000FF,&H00000000,&H66000000,0,0,0,0,100,100,0,0,1,2,0,2,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Fixture subtitle
`,
        ),
      },
    },
  });
  expect(subtitleUpload.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByLabel("Dashboard")).toBeVisible();

  await page.goto("/scenes");
  await expect(page.getByText(new RegExp(firstScene.title, "i")).first()).toBeVisible();

  await page.goto(`/scenes/${firstScene.id}`);
  await expect(page.getByText("Transcript").first()).toBeVisible();

  await page.goto("/jobs");
  await expect(page.getByText("Queues")).toBeVisible();
});
