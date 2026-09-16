/** robots.txt okuyucu: sitelerin otomatik okunmasına izin verdiği sayfaları belirler. */
export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

interface Group {
  agents: string[];
  allow: string[];
  disallow: string[];
}

/** Bizim istemciye (FiyatVerici) özel grup varsa onu, yoksa "*" grubunu kullanır. */
export function parseRobots(txt: string, agent = "fiyatverici"): RobotsRules {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], allow: [], disallow: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur || !val) continue;
    if (key === "allow") cur.allow.push(val);
    else if (key === "disallow") cur.disallow.push(val);
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return { allow: chosen.flatMap((g) => g.allow), disallow: chosen.flatMap((g) => g.disallow) };
}

function matchLength(pattern: string, path: string): number {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp("^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path) ? body.length : -1;
}

/** En uzun eşleşen kural kazanır; eşitlikte izin verilir (Google'ın yorumu). */
export function isAllowed(rules: RobotsRules, pathWithQuery: string): boolean {
  let best = -1;
  let allowed = true;
  for (const p of rules.disallow) {
    const n = matchLength(p, pathWithQuery);
    if (n > best) {
      best = n;
      allowed = false;
    }
  }
  for (const p of rules.allow) {
    const n = matchLength(p, pathWithQuery);
    if (n >= best && n >= 0) {
      best = n;
      allowed = true;
    }
  }
  return allowed;
}
