/* 살아서 운동장까지 — 전 구간 자동 주행 검증.
   ① 전 장면 즉답 정답 → S등급  ② 연속 오답 → 산소 0 → 게임오버 → 재도전  ③ 시간초과(머뭇거림) → 재선택 */
const { chromium } = require("C:/Users/USER/Downloads/프로젝트/naverestate-mcp/node_modules/playwright");
const URL = "file:///C:/Users/USER/Downloads/%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/school-earthquake-drill/index.html";
const SHOT = "C:/Users/USER/Downloads/프로젝트/school-earthquake-drill/tests/shots/";
const errors = [];

async function waitChoices(p) {
  await p.waitForFunction(() => document.querySelector("#choices").classList.contains("on"), null, { timeout: 15000 });
}
async function pick(p, correct) {
  await p.evaluate(c => {
    const btns = [document.querySelector("#ch-0"), document.querySelector("#ch-1")];
    btns.find(b => b.dataset.correct === (c ? "1" : "0")).click();
  }, correct);
}
const chip = p => p.evaluate(() => document.querySelector("#scene-chip").textContent.trim());
const o2 = p => p.evaluate(() => document.querySelector("#o2pct").textContent);

(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => errors.push("pageerror: " + String(e)));
  p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await p.goto(URL);
  await p.waitForTimeout(700);
  await p.screenshot({ path: SHOT + "01-intro.png" });

  /* ── ① 정답 경로: 전 장면 즉답 → S ── */
  await p.click("#btn-start");
  const seen = [];
  for (let i = 0; i < 6; i++) {
    await waitChoices(p);
    seen.push(await chip(p) + " o2=" + await o2(p));
    if (i === 0) { await p.waitForTimeout(600); await p.screenshot({ path: SHOT + "02-s1-choices.png" }); }
    if (i === 2) { await p.waitForTimeout(600); await p.screenshot({ path: SHOT + "03-s3-choices.png" }); }
    await pick(p, true);
    await p.waitForFunction(() => !document.querySelector("#choices").classList.contains("on"));
  }
  await p.waitForFunction(() => document.querySelector("#scr-result").classList.contains("on"), null, { timeout: 10000 });
  const res1 = await p.evaluate(() => ({
    grade: document.querySelector("#r-grade").textContent,
    sub: document.querySelector("#r-sub").textContent.replace(/\s+/g, " "),
    o2: document.querySelector("#r-o2pct").textContent,
    rows: document.querySelectorAll(".tl-row").length,
    flagged: document.querySelectorAll(".tl-row.flag").length,
    tnote: !!document.querySelector(".t-note")
  }));
  await p.screenshot({ path: SHOT + "04-result-S.png", fullPage: true });
  console.log("① 정답경로 장면:", JSON.stringify(seen));
  console.log("① 결과:", JSON.stringify(res1));

  /* ── ② 오답 연타: S1오답(65)→정답, S2오답(30)→정답, S3오답(0)→게임오버→재도전 ── */
  await p.click("#btn-again");
  // S1 오답
  await waitChoices(p); await pick(p, false);
  await p.waitForFunction(() => document.querySelector("#veil").classList.contains("on"), null, { timeout: 8000 });
  const m1 = await p.evaluate(() => document.querySelector("#m-tag").textContent + " | " + document.querySelector("#m-rule").textContent.replace(/\s+/g, " ").slice(0, 40));
  console.log("② S1 오답모달:", m1, "o2=", await o2(p));
  await p.screenshot({ path: SHOT + "05-wrong-modal.png" });
  await p.click("#m-ok");
  await waitChoices(p); await pick(p, true); // S1 재선택 정답
  // S2 오답
  await waitChoices(p); await pick(p, false);
  await p.waitForFunction(() => document.querySelector("#veil").classList.contains("on"));
  console.log("② S2 오답 후 o2=", await o2(p));
  await p.click("#m-ok");
  await waitChoices(p); await pick(p, true);
  // S3 오답 → 엘리베이터 오답영상 컷 + 산소 0 → 게임오버
  await waitChoices(p); await pick(p, false);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: SHOT + "06-wrongA-elevator.png" });
  await p.waitForFunction(() => document.querySelector("#veil").classList.contains("on"), null, { timeout: 8000 });
  const over = await p.evaluate(() => document.querySelector("#m-tag").textContent + " | " + document.querySelector("#m-title").textContent);
  console.log("② S3 오답(산소0) 모달:", over, "o2=", await o2(p));
  await p.screenshot({ path: SHOT + "07-gameover.png" });
  await p.click("#m-ok"); // 재도전
  await waitChoices(p);
  console.log("② 재도전 후:", await chip(p), "o2=", await o2(p));

  /* ── ③ 시간초과: 4초 방치 → 머뭇거림 −20 → 재선택 ── */
  await p.waitForTimeout(4600); // 카운트다운 소진
  await p.waitForFunction(() => document.querySelector("#choices").classList.contains("on"), null, { timeout: 10000 }); // 재선택 재등장
  console.log("③ 머뭇거림 후 재선택:", await chip(p), "o2=", await o2(p));
  await p.screenshot({ path: SHOT + "08-after-timeout.png" });

  console.log("에러:", errors.length ? errors : "없음");
  await b.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
