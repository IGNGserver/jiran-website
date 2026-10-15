import { ASSET_PATTERNS, REPO, RELEASES_URL, type AssetKey } from './product';

export interface ReleaseInfo {
  tag: string;
  url: string;
  publishedAt: string;
  assets: Partial<Record<AssetKey, { name: string; url: string; size: number }>>;
}

interface GhAsset { name: string; browser_download_url: string; size: number }
interface GhRelease { tag_name: string; html_url: string; published_at: string; draft: boolean; prerelease: boolean; assets: GhAsset[] }

/**
 * 取「当前正式版」：最新一个既非 draft 也非 prerelease 的发布。
 * 不用 /releases/latest —— 那个端点只认 GitHub 上手动标记的 Latest，可能落后于新正式版。
 * 这与产品的更新通道语义一致（正式版只考虑非 prerelease 的发布）。
 */
export function pickStable(list: GhRelease[]): ReleaseInfo | null {
  const rel = list.find((r) => !r.draft && !r.prerelease);
  if (!rel) return null;
  const assets: ReleaseInfo['assets'] = {};
  for (const [key, re] of Object.entries(ASSET_PATTERNS) as [AssetKey, RegExp][]) {
    const hit = rel.assets.find((a) => re.test(a.name));
    if (hit) assets[key] = { name: hit.name, url: hit.browser_download_url, size: hit.size };
  }
  return { tag: rel.tag_name, url: rel.html_url, publishedAt: rel.published_at, assets };
}

let cached: Promise<ReleaseInfo | null> | undefined;

/** 构建时调用一次；网络失败或设置 JIRAN_OFFLINE=1 时返回 null，页面退化为指向 Releases 页面的链接。 */
export function getRelease(): Promise<ReleaseInfo | null> {
  cached ??= (async () => {
    if (process.env.JIRAN_OFFLINE === '1') return null;
    try {
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'jiran-website-build' };
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      return pickStable((await res.json()) as GhRelease[]);
    } catch (err) {
      console.warn(`[release] 无法读取 ${REPO} 的发布信息，下载按钮将指向 ${RELEASES_URL}：${(err as Error).message}`);
      return null;
    }
  })();
  return cached;
}
