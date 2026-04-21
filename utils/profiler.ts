import type { ScrollProfile } from "@/types";

export function matchProfile(
  url: string,
  profiles: ScrollProfile[],
): ScrollProfile | null {
  for (const profile of profiles) {
    for (const pattern of profile.sitePatterns) {
      if (matchUrlPattern(url, pattern)) {
        return profile;
      }
    }
  }
  return null;
}

function matchUrlPattern(url: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  try {
    return new RegExp(`^${regex}$`, "i").test(url);
  } catch {
    return false;
  }
}
