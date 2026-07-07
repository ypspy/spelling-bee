const TZ = "Asia/Seoul";

function formatDateKST(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function todayKST() {
  return formatDateKST(new Date());
}

function addDaysKST(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

function isValidDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampWordRange(from, to) {
  const today = todayKST();
  const maxFrom = addDaysKST(today, -3);
  if (from && !isValidDateStr(from)) from = maxFrom;
  if (to && !isValidDateStr(to)) to = today;
  const effectiveTo = !to || to > today ? today : to;
  const effectiveFrom = !from || from < maxFrom ? maxFrom : from;
  if (effectiveFrom > effectiveTo) return { from: today, to: today };
  return { from: effectiveFrom, to: effectiveTo };
}

module.exports = { todayKST, addDaysKST, isValidDateStr, clampWordRange };
