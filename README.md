
# Codeforces 鐧诲綍涓庨鐩鐞嗙郴缁燂紙鍩轰簬 Electron锛?

## 1. 椤圭洰姒傝堪

璇ラ」鐩槸涓€涓熀浜?Electron 鐨勬闈㈠簲鐢ㄧ▼搴忥紝鏃ㄥ湪瀹炵幇瀵?[Codeforces](https://codeforces.com) 骞冲彴鐨勮嚜鍔ㄧ櫥褰曘€侀鐩媺鍙栦笌鍙戝竷鎿嶄綔銆傜敤鎴峰彲浠ラ€氳繃 GUI 鐣岄潰鐧诲綍 Codeforces锛岃嚜鍔ㄨ幏鍙?Cookies锛屽苟鍩轰簬棰樼洰鏍囩鍖洪棿鍜屾暟閲忔媺鍙栨寚瀹氶搴撻鐩紝鏈€缁堝皢鍏剁敤浜庢瀯寤烘瘮璧涙垨瀛樺偍銆?

---

## 2. 鎶€鏈€夊瀷

| 鎶€鏈?                   | 璇存槑                           |
| ----------------------- | ------------------------------ |
| **Electron**            | 鐢ㄤ簬鏋勫缓璺ㄥ钩鍙扮殑妗岄潰搴旂敤绋嬪簭   |
| **TypeScript**          | 鎻愰珮浠ｇ爜鍙淮鎶ゆ€у拰绫诲瀷瀹夊叏     |
| **Node.js + Fetch API** | 瀹炵幇涓?Codeforces 鐨?HTTP 閫氫俊 |
| **HTML/CSS/JS**         | 鏋勫缓鍓嶇浜や簰鐣岄潰               |

---

## 3. 鍔熻兘妯″潡鍒掑垎

| 妯″潡鍚?            | 璇存槑                                     |
| ------------------ | ---------------------------------------- |
| `main.ts`          | Electron 涓昏繘绋嬶細绐楀彛绠＄悊锛岀洃鍚簨浠?     |
| `preload.ts`       | 娓叉煋杩涚▼鍜屼富杩涚▼閫氫俊妗ユ                 |
| `login.html`       | 鐧诲綍椤甸潰锛氬睍绀?WebView 鐧诲綍骞舵彁鍙?Cookie |
| `publicProblem.ts` | 鎷夊彇棰樼洰鏁版嵁銆佺敓鎴愭瘮璧涢鍗?              |
| `fetchGroups.ts`   | 鐧诲綍鍚庢姄鍙?Codeforces 缇ょ粍椤甸潰 HTML      |
| `setProblem.html`  | 鐢ㄦ埛杈撳叆棰樼洰鏁伴噺涓庢爣绛捐寖鍥磋繘琛岀瓫閫?      |
| `mygroup.html`     | 灞曠ず鎶撳彇鍒扮殑缇ょ粍椤甸潰锛堥儴鍒嗗姛鑳斤級         |

---

## 4. 椤圭洰杩愪綔娴佺▼

### 锛?锛夌櫥褰曟祦绋?

1. 鐢ㄦ埛杩愯绋嬪簭锛孍lectron 鍔犺浇 `login.html` 椤甸潰锛?
2. `login.html` 涓祵鍏?Codeforces 鐧诲綍椤?WebView锛?
3. 鐢ㄦ埛鎵嬪姩鐧诲綍鍚庯紝`preload.ts` 鑷姩鐩戝惉鐧诲綍鎴愬姛骞舵彁鍙?Cookie锛?
4. Cookie 琚繚瀛樺埌涓昏繘绋嬶紝鍏ㄥ眬浣跨敤銆?

### 锛?锛夎缃鐩祦绋?

1. 鐧诲綍鎴愬姛鍚庤烦杞埌 `setProblem.html`锛?
2. 鐢ㄦ埛濉啓姣旇禌淇℃伅锛?
   - 姣旇禌鍚嶇О锛?
   - 姣旇禌鏃堕暱锛?
   - 棰樼洰鏁帮紱
   - 鏍囩闅惧害鑼冨洿锛堟敮鎸佸鍖洪棿锛夛紱
3. 椤甸潰鍙戦€?`ipcRenderer` 娑堟伅鑷充富杩涚▼锛岃皟鐢?`publicProblem()`銆?



### 鍐呴儴娴佺▼锛?

1. 閫氳繃 Codeforces API (`problemset.problems`) 鑾峰彇鏁版嵁骞跺畨瑁呮暟鎹繚瀛樺眬;

2. 鎸夋嫨鐢ㄦ埛璁剧疆鐨勬礇鏈熷尯闂翠负闅忔満鎶藉彇鐨勮鐩紱

3. 闅忔満鎶藉彇涓€閮ㄤ笌鑼冨洿鍖哄垎瀛樼涓€瀵瑰寘鍚崟渚嬬殑棰樼洰锛屾嫿璐濇棫绠＄粏閬欓噺閲嶅;

4. 鏁版嵁鍒嗚В鍚庡皢琚紦瀛樻垚 Mashup API 闇€瑕佺殑 JSON 鏍煎紡骞跺彂甯冩祦绋嬨€?

## 5. 鏍稿績浠ｇ爜閫昏緫璇存槑  

**鑾峰彇棰樼洰娴佺▼锛堟憳鑷?`getProblems` 鍑芥暟锛夛細**

```ts
const problemset = await loadProblemset(); // API 鑾峰彇鏁版嵁
return ranges.map((range) => pickRandomProblem(problemset, range, used));
```

**鍏叡棰樼洰缁勮閫昏緫锛?*

```ts
const problems1 = await getProblems(tagsRange, count);
const problems = encode_self(problems1);

```



