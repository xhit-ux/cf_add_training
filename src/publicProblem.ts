import fetch from "node-fetch";
import { session } from "electron";

type RatingRange = [number, number];

interface CFProblem {
  contestId?: number;
  index: string;
  rating?: number;
  name?: string;
}

interface CFProblemsetResponse {
  status: string;
  result?: {
    problems: CFProblem[];
  };
  comment?: string;
  name?: string;
}

interface SelectedProblem {
  contestId: string;
  index: string;
}

interface ProblemQueryResponse {
  success: string;
  problems?: {
    id: string;
  }[];
  comment?: string;
}

/**
 * Codeforces API endpoint that returns the entire public problemset.
 * We cache the result for a short period to avoid unnecessary network calls.
 */
const CF_PROBLEMSET_URL = "https://codeforces.com/api/problemset.problems";
const PROBLEMSET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedProblems: CFProblem[] | null = null;
let cachedAt = 0;

async function loadProblemset(): Promise<CFProblem[]> {
  const now = Date.now();
  if (cachedProblems && now - cachedAt < PROBLEMSET_CACHE_TTL) {
    return cachedProblems;
  }

  const response = await fetch(CF_PROBLEMSET_URL);
  if (!response.ok) {
    throw new Error(`Codeforces API responded with ${response.status}`);
  }

  const payload = (await response.json()) as CFProblemsetResponse;
  if (payload.status !== "OK" || !payload.result?.problems) {
    throw new Error(
      `Failed to load problemset: ${payload.comment || "unknown error"}`
    );
  }

  cachedProblems = payload.result.problems;
  cachedAt = now;
  return cachedProblems;
}

function pickRandomProblem(
  allProblems: CFProblem[],
  range: RatingRange,
  used: Set<string>
): SelectedProblem {
  const [min, max] = range;
  const pool = allProblems.filter(
    (p) =>
      typeof p.contestId === "number" &&
      typeof p.rating === "number" &&
      p.contestId >= 800 &&
      p.rating >= min &&
      p.rating <= max &&
      !used.has(`${p.contestId}${p.index}`)
  );

  if (!pool.length) {
    throw new Error(
      `No available problems in rating range ${min}-${max}. Try widening the range.`
    );
  }

  const choice = pool[Math.floor(Math.random() * pool.length)];
  const key = `${choice.contestId}${choice.index}`;
  used.add(key);
  console.log("[+-+] 题目名称:", choice.name, "ID:", choice.contestId);

  return { contestId: String(choice.contestId), index: choice.index };
}

export async function getProblems(
  tagsRange: RatingRange[],
  count: number
): Promise<SelectedProblem[]> {
  if (tagsRange.length !== count) {
    throw new Error("Rating range count does not match requested problem count");
  }

  const problemset = await loadProblemset();
  const used = new Set<string>();

  return tagsRange.map((range) => pickRandomProblem(problemset, range, used));
}

async function queryProblemId(
  problem: SelectedProblem,
  csrfToken: string,
  previouslyAddedProblemCount: number
): Promise<string> {
  const formData = new URLSearchParams({
    action: "problemQuery",
    problemQuery: `${problem.contestId}${problem.index}`,
    previouslyAddedProblemCount: previouslyAddedProblemCount.toString(),
    csrf_token: csrfToken
  });

  const response = await session
    .fromPartition("persist:authsession")
    .fetch("https://codeforces.com/data/mashup", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: "https://codeforces.com/mashup/new",
        "X-Csrf-Token": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://codeforces.com",
        Accept: "application/json, text/javascript, */*; q=0.01"
      },
      body: formData.toString()
    });

  if (!response.ok) {
    throw new Error(`problemQuery failed: ${response.status}`);
  }

  const payload = (await response.json()) as ProblemQueryResponse;
  if (payload.success !== "true" || !payload.problems?.length) {
    throw new Error(
      `Unable to resolve problem ${problem.contestId}${problem.index}: ${
        payload.comment || "no candidates"
      }`
    );
  }

  return payload.problems[0].id;
}

async function resolveProblemIds(
  problems: SelectedProblem[],
  csrfToken: string
): Promise<{ id: string; index: string }[]> {
  const resolved: { id: string; index: string }[] = [];

  for (let i = 0; i < problems.length; i++) {
    const canonicalId = await queryProblemId(problems[i], csrfToken, i);
    resolved.push({ id: canonicalId, index: problems[i].index });
  }

  return resolved;
}

function encode_self(problems: { id: string; index: string }[]): string {
  const updated = problems.map((p, i) => ({
    id: p.id,
    index: String.fromCharCode(65 + i) // Assign A, B, C... sequential indices in mashup
  }));
  const temps = JSON.stringify(updated);
  console.log(temps);
  return temps;
}

export async function publicProblem(
  csrfToken: string,
  contestName: string,
  contestDuration: number,
  tagsRange: RatingRange[],
  count: number
): Promise<string> {
  const selectedProblems = await getProblems(tagsRange, count);
  console.log("题目信息:", selectedProblems);

  const canonicalProblems = await resolveProblemIds(selectedProblems, csrfToken);
  const problems = encode_self(canonicalProblems);
  const postData = new URLSearchParams({
    action: "saveMashup",
    isCloneContest: "false",
    parentContestIdAndName: "",
    parentContestId: "",
    contestName,
    contestDuration: contestDuration.toString(),
    problemsJson: problems,
    csrf_token: csrfToken
  });

  const response = await session
    .fromPartition("persist:authsession")
    .fetch("https://codeforces.com/data/mashup", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: "https://codeforces.com/mashup/new",
        "X-Csrf-Token": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://codeforces.com",
        Accept: "application/json, text/javascript, */*; q=0.01"
      },
      body: postData.toString()
    });

  console.log("[+] 状态:", response.status);
  const text = await response.text();
  console.log("[+] 响应:", text);

  try {
    const json = JSON.parse(text);
    if (json.success === "true" && json.newMashupContestId) {
      console.log("[+] return contestID:", json.newMashupContestId);
      return json.newMashupContestId;
    }
  } catch (e) {
    console.error("解析 JSON 失败:", e);
  }
  console.log("[-] contestId wrong");
  return "";
}
