import https from 'https';
import zlib from 'zlib';
import { session } from "electron";

/**
 * 拉题操作函数
 * @param cookieHeader 已提取的 cookie 请求头字符串
 * @param csrfToken 提取的 csrf_token
 * @param contestName 比赛名称
 * @param contestDuration 比赛时长（单位分钟）
 * @param problems 题目数组，每个元素包含 id 和 index，如 { id: '3442674', index: 'A' }
 */


function decodeBuffer(buffer: Buffer, encoding?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (encoding === 'br') {
      zlib.brotliDecompress(buffer, (err, result) => {
        if (err) return reject(err);
        resolve(result.toString());
      });
    } else if (encoding === 'gzip') {
      zlib.gunzip(buffer, (err, result) => {
        if (err) return reject(err);
        resolve(result.toString());
      });
    } else if (encoding === 'deflate') {
      zlib.inflate(buffer, (err, result) => {
        if (err) return reject(err);
        resolve(result.toString());
      });
    } else {
      resolve(buffer.toString());
    }
  });
}


export async function catProblemnums(
  cookie: string,
  tagsRange: [number, number],
  page: number = 1): Promise<number> {
  return new Promise((resolve, reject) => {
    const path = `/problemset/page/${page}?tags=${tagsRange[0]}-${tagsRange[1]}`
    
    const options = {
      hostname: 'codeforces.com',
      path,
      method: 'GET',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': `https://codeforces.com/problemset/page/${page}?tags=${tagsRange[0]}-${tagsRange[1]}`,
        'Upgrade-Insecure-Requests': '1'
      }
    }

    const req = https.request(options, res => {
      const chunks: any[] = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const encoding = res.headers['content-encoding']
        let html: string

        if (encoding === 'br') {
          html = zlib.brotliDecompressSync(buffer).toString()
        } else if (encoding === 'gzip') {
          html = zlib.gunzipSync(buffer).toString()
        } else if (encoding === 'deflate') {
          html = zlib.inflateSync(buffer).toString()
        } else {
          html = buffer.toString()
        }
        const matches = Array.from(html.matchAll(/pageIndex="(\d+)"/g));
        const pageNumbers = matches.map(m => parseInt(m[1]));
        const lastPage = Math.max(...pageNumbers);
        if (page != lastPage) {
          catProblemnums(cookie, tagsRange, lastPage).then(maxproblem => resolve(maxproblem)).catch(reject);
          return; // 递归时记得return，防止继续执行下面代码
        }
        else {
          const tableMatch = html.match(/<table class="problems">[\s\S]*?<\/table>/);
          if (!tableMatch) {
            console.error("未找到 problems 表格");
          } else {
            const tableHtml = tableMatch[0];
          
            // 匹配所有 <tr>...</tr>，不区分 class，有或无属性都能匹配
            const trMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
          
            // 第一个 <tr> 是表头，需要排除
            const contentRowCount = trMatches ? trMatches.length - 1 : 0;
            const maxproblem = (lastPage - 1) * 100 + contentRowCount;
            console.log("该范围题目总数:", maxproblem);
            resolve(maxproblem);
          }
        }
      })
    })

    req.on('error', err => {
      console.error('[-] 请求错误:', err)
      reject(err)
    })

    req.end()
  })
}

export async function getProblems(
  cookie: string,
  tagsRange: [number, number][],
  count: number
): Promise<{ id: string; index: string }[]> {
  const nums:number[] = [];
  for (let index = 0; index < count; index++) {
    nums.push(await catProblemnums(cookie, tagsRange[index]));
  }

  const selectedNumbers = new Set<number>();
  const randomInt = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  // 随机抽取 count 个题号（防止重复）
  while (selectedNumbers.size < count) {
    selectedNumbers.add(randomInt(1, nums[selectedNumbers.size]));
  }

  const problems: { id: string; index: string }[] = [];
  let p = 0;
  for (const number of selectedNumbers) {
    const page = Math.ceil(number / 100);
    const offset = number % 100;

    // 调用 pullProblem 获取题目数据
    const problem = await pullProblem(cookie, tagsRange[p][0], tagsRange[p][1], page, offset); 
    p++;
    problems.push(problem);
  }

  return problems;
}

export function pullProblem(
  cookie: string,
  tags_low: number,
  tags_high: number,
  page: number,
  offset: number
): Promise<{ id: string; index: string }> {
  return new Promise((resolve, reject) => {
    offset += 1; // 第一个 <tr> 是表头
    const path = `/problemset/page/${page}?tags=${tags_low}-${tags_high}`;

    const options = {
      hostname: 'codeforces.com',
      path,
      method: 'GET',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': `https://codeforces.com/problemset/page/${page}?tags=${tags_low}-${tags_high}`,
        'Upgrade-Insecure-Requests': '1'
      }
    };

    const req = https.request(options, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const encoding = res.headers['content-encoding'];
        let html: string;

        try {
          if (encoding === 'br') {
            html = zlib.brotliDecompressSync(buffer).toString();
          } else if (encoding === 'gzip') {
            html = zlib.gunzipSync(buffer).toString();
          } else if (encoding === 'deflate') {
            html = zlib.inflateSync(buffer).toString();
          } else {
            html = buffer.toString();
          }
        } catch (e) {
          return reject(e);
        }

        //csrf测试
        // const csr_match = html.match(/<input\s+type=['"]hidden['"]\s+name=['"]csrf_token['"]\s+value=['"]([a-f0-9]{32})['"]\s*\/?>/i);
        // let csrf_test=""
        // if (csr_match) {
        //   csrf_test = csr_match[1];
        //   console.log('[+] 提取到 csrf_token:', csrf_test);
        // } else {
        //   console.warn('[-] 未能提取 csrf_token');
        //   csrf_test = '';
        // }
        //csrf测试

        //在线状态测试
        const online_match = html.match(/ahit_UX/);
        let online_test=""
        if (online_match) {
          online_test = online_match[0];
          console.log('[+] 在线:', online_test);
        } else {
          console.warn('[-] 已经离线');
        }
        //在线状态测试


        const tableMatch = html.match(/<table class="problems">[\s\S]*?<\/table>/);
        if (!tableMatch) {
          return reject(new Error("未找到题目表格"));
        }

        const tableHtml = tableMatch[0];
        const trMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g));

        if (offset >= trMatches.length) {
          return reject(new Error("offset 超出范围"));
        }

        const tr = trMatches[offset];
        const aMatch = tr[0].match(/<a href="\/problemset\/problem\/(\d+)\/([A-Z])">/);
        if (!aMatch) {
          return reject(new Error("未能从 <tr> 中解析出题号和编号"));
        }

        const id = aMatch[1];     // 如 "2117"
        const index = aMatch[2];  // 如 "E"

        resolve({ id, index });
      });
    });

    req.on('error', err => {
      reject(err);
    });

    req.end();
  });
}

function encode_self(problems: { id: string; index: string }[]): string {
  const updated = problems.map((p, i) => ({
    id: p.id,
    index: String.fromCharCode(65 + i)  // 65 是 'A' 的 ASCII
  }));
  const temps = JSON.stringify(updated);
  console.log(temps);
  return temps;
}


export async function publicProblem(
  csrfToken: string,
  contestName: string,
  contestDuration: number,
  tagsRange: [number, number][],
  count: number
): Promise<string> {
  // 用 Electron 的 session 拿 cookie（Cloudflare 认可的）
  const cookies = await session.fromPartition("persist:authsession").cookies.get({ url: "https://codeforces.com" });
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

  const problems1 = await getProblems(cookieHeader, tagsRange, count);
  console.log("题目信息:", problems1);

  const problems = encode_self(problems1);
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

  const response = await session.fromPartition("persist:authsession").fetch("https://codeforces.com/data/mashup", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Referer": "https://codeforces.com/mashup/new",
      "X-Csrf-Token": csrfToken,
      "X-Requested-With": "XMLHttpRequest",
      "Origin": "https://codeforces.com",
      "Accept": "application/json, text/javascript, */*; q=0.01"
    },
    body: postData.toString()
  });

  console.log("[+] 状态:", response.status);
  const text = await response.text();
  console.log("[+] 响应:", text);

  try {
    const json = JSON.parse(text);
    if (json.success === "true" && json.newMashupContestId) {
      return json.newMashupContestId; // ✅ 返回 contestId
    }
  } catch (e) {
    console.error("解析 JSON 出错:", e);
  }

  return ""; // 失败情况返回 null
}