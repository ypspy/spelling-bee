const dailyPanel = document.getElementById("dailyPanel");
const wwPanel = document.getElementById("wwPanel");
const tabs = document.querySelectorAll(".tab-bar .tab");
const dailyInited = { value: false };
const wwInited = { value: false };

function showTab(name) {
  const isDaily = name === "daily";
  dailyPanel.classList.toggle("hidden", !isDaily);
  wwPanel.classList.toggle("hidden", isDaily);
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  localStorage.setItem("activeTab", name);
  if (isDaily) {
    if (!dailyInited.value) {
      DailyNotebook.init();
      dailyInited.value = true;
    }
  } else if (!wwInited.value) {
    WordlyWise.init();
    wwInited.value = true;
  }
}

tabs.forEach(t => { t.onclick = () => showTab(t.dataset.tab); });
showTab(localStorage.getItem("activeTab") === "ww" ? "ww" : "daily");
