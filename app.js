const STORAGE_KEY = "thanksgiving-signups";

const form = document.getElementById("signup-form");
const list = document.getElementById("list");
const empty = document.getElementById("empty");
const total = document.getElementById("total");

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save(signups) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signups));
  } catch {
    // storage unavailable (e.g. private mode); list just won't persist
  }
}

let signups = load();

function render() {
  list.innerHTML = "";
  empty.hidden = signups.length > 0;

  const guestCount = signups.reduce((sum, s) => sum + s.guests, 0);
  total.textContent = signups.length ? `(${guestCount} guest${guestCount === 1 ? "" : "s"})` : "";

  signups.forEach((s, i) => {
    const li = document.createElement("li");

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = s.category;

    const info = document.createElement("div");
    info.className = "info";
    const dish = document.createElement("strong");
    dish.textContent = s.dish;
    const who = document.createElement("small");
    who.textContent = ` — ${s.name}${s.guests > 1 ? ` (+${s.guests - 1})` : ""}`;
    info.append(dish, who);

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.type = "button";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", `Remove ${s.name}`);
    remove.addEventListener("click", () => {
      signups.splice(i, 1);
      save(signups);
      render();
    });

    li.append(tag, info, remove);
    list.append(li);
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  signups.push({
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value,
    dish: document.getElementById("dish").value.trim(),
    guests: Math.max(1, parseInt(document.getElementById("guests").value, 10) || 1),
  });
  save(signups);
  render();
  form.reset();
  document.getElementById("name").focus();
});

render();
