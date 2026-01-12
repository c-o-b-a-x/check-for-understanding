// Handle JSON file upload and display its content

document
  .getElementById("fileInput")
  .addEventListener("change", handleFileSelect);

function handleFileSelect(event) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const jsonObject = JSON.parse(reader.result);
      console.log(jsonObject);

      document.getElementById("output").textContent = JSON.stringify(
        jsonObject,
        null,
        2
      );
    } catch (err) {
      document.getElementById("output").textContent = "Invalid JSON file";
    }
  };

  reader.readAsText(file);
}
fetch("/example.json")
  .then((res) => res.json())
  .then((data) => {
    document.getElementById("Example").textContent = JSON.stringify(
      data,
      null,
      2
    );
  })
  .catch(() => {
    document.getElementById("Example").textContent = "Failed to load JSON file";
  });

// Theme toggle functionality
function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
}

function getCookie(name) {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) return value;
  }
  return null;
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
}

const savedTheme = getCookie("theme") || "light";
applyTheme(savedTheme);

document.getElementById("themeToggle").onclick = () => {
  const newTheme = document.body.classList.contains("light") ? "dark" : "light";

  applyTheme(newTheme);
  setCookie("theme", newTheme);
};
