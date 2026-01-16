const http = require("http");

function get(path, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "localhost", port: 3000, path, timeout }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function main() {
  const res = await get("/table");
  if (res.status !== 200) {
    console.error("Request failed:", res.status);
    process.exit(1);
  }
  const data = JSON.parse(res.body);
  const words = Array.isArray(data.words) ? data.words : [];
  if (!words.length) {
    console.log("No words");
    return;
  }

  const w = words[Math.floor(Math.random() * words.length)];
  const r = await get(`/translation/${w._id}?full=1`);
  console.log("Word:", w.text);
  console.log("Status:", r.status);
  console.log("Body:", r.body);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
