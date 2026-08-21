document.addEventListener("DOMContentLoaded", function () {
  const menuButton = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");
  if (!menuButton || !menu) return;

  menuButton.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = menu.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      menu.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
});
