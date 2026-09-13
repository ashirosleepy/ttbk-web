const storedTheme = localStorage.getItem("ttbk-theme");
const theme = storedTheme === "light" || storedTheme === "dark"
  ? storedTheme
  : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

document.documentElement.setAttribute("data-theme", theme);
document.documentElement.classList.add("pg-fade");
