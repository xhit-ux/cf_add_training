import https from 'https';
import zlib from 'zlib';
import querystring from 'querystring';

/**
 * 拉题操作函数
 * @param cookieHeader 已提取的 cookie 请求头字符串
 * @param csrfToken 提取的 csrf_token
 * @param contestName 比赛名称
 * @param contestDuration 比赛时长（单位分钟）
 * @param problems 题目数组，每个元素包含 id 和 index，如 { id: '3442674', index: 'A' }
 */


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
            console.log("题目总数:", maxproblem);
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
  const jsonStr = JSON.stringify(updated);
  return encodeURIComponent(jsonStr);
}


export async function publicProblem(
  cookieHeader: string,
  csrfToken: string,
  contestName: string,
  contestDuration: number,
  tagsRange: [number, number][],
  count: number
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const problems1 = await getProblems(cookieHeader, tagsRange, count);
    console.log(problems1);
    const problems = encode_self(problems1);
    console.log(problems);
  //   const postData = querystring.stringify({
  //     action: 'saveMashup',
  //     isCloneContest: 'false',
  //     parentContestIdAndName: '',
  //     parentContestId: '',
  //     contestName,
  //     contestDuration: contestDuration.toString(),
  //     problemsJson: JSON.stringify(problems),
  //     csrf_token: csrfToken
  //   });

  //   const options: https.RequestOptions = {
  //     hostname: 'codeforces.com',
  //     path: '/data/mashup',
  //     method: 'POST',
  //     headers: {
  //       'Host': 'codeforces.com',
  //       'Cookie': cookieHeader,
  //       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
  //       'Accept': 'application/json, text/javascript, */*; q=0.01',
  //       'Accept-Language': 'zh-CN,zh;q=0.8',
  //       'Accept-Encoding': 'gzip, deflate, br',
  //       'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  //       'Content-Length': Buffer.byteLength(postData),
  //       'Referer': 'https://codeforces.com/mashup/new',
  //       'X-Csrf-Token': csrfToken,
  //       'X-Requested-With': 'XMLHttpRequest',
  //       'Origin': 'https://codeforces.com',
  //       'Sec-Fetch-Dest': 'empty',
  //       'Sec-Fetch-Mode': 'cors',
  //       'Sec-Fetch-Site': 'same-origin',
  //       'Te': 'trailers'
  //     }
  //   };

  //   const req = https.request(options, res => {
  //     const chunks: Buffer[] = [];

  //     res.on('data', chunk => {
  //       chunks.push(chunk);
  //     });

  //     res.on('end', () => {
  //       const buffer = Buffer.concat(chunks);
  //       let responseBody: string;

  //       const encoding = res.headers['content-encoding'];
  //       if (encoding === 'br') {
  //         responseBody = zlib.brotliDecompressSync(buffer).toString();
  //       } else if (encoding === 'gzip') {
  //         responseBody = zlib.gunzipSync(buffer).toString();
  //       } else if (encoding === 'deflate') {
  //         responseBody = zlib.inflateSync(buffer).toString();
  //       } else {
  //         responseBody = buffer.toString();
  //       }

  //       console.log('[+] 拉题请求响应:');
  //       console.log(responseBody);
  //       resolve();
  //     });
  //   });

  //   req.on('error', err => {
  //     console.error('[-] 拉题请求错误:', err);
  //     reject(err);
  //   });

  //   req.write(postData);
  //   req.end();
  });
}
