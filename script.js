document.addEventListener("DOMContentLoaded", function () {
  const menu = document.getElementById("mobileMenu");

  document.addEventListener("click", function (e) {
    const target = e.target.closest("button, a, div");

    if (target && target.textContent.includes("選單")) {
      menu.classList.toggle("open");
    }
  });

  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      menu.classList.remove("open");
    });
  });
});
