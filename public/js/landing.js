/* Landing page: view switching + scroll-reveal animations.
   Loads after app.js, so it can reuse authView/appView/switchAuthTab. */

function showLandingView() {
  document.getElementById("appView")?.classList.add("hidden");
  document.getElementById("authView")?.classList.add("hidden");
  document.getElementById("landingView")?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function enterAuthView(tab) {
  document.getElementById("landingView")?.classList.add("hidden");
  document.getElementById("appView")?.classList.add("hidden");
  document.getElementById("authView")?.classList.remove("hidden");

  if (typeof switchAuthTab === "function") {
    switchAuthTab(tab || "login");
  }

  window.scrollTo({ top: 0, behavior: "instant" });
}

document
  .getElementById("landingSignInBtn")
  ?.addEventListener("click", () => enterAuthView("login"));

document
  .getElementById("landingGetStartedNavBtn")
  ?.addEventListener("click", () => enterAuthView("register"));

document
  .getElementById("landingHeroGetStartedBtn")
  ?.addEventListener("click", () => enterAuthView("register"));

document
  .getElementById("landingFinalCtaBtn")
  ?.addEventListener("click", () => enterAuthView("register"));

document
  .getElementById("landingHeroHowItWorksBtn")
  ?.addEventListener("click", () => {
    document
      .getElementById("howItWorks")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

document
  .getElementById("authBackToHome")
  ?.addEventListener("click", () => showLandingView());

// Actions inside the How It Works reference section.
document
  .getElementById("landingFlowGetStartedBtn")
  ?.addEventListener("click", () => enterAuthView("register"));

document
  .getElementById("landingFlowBottomGetStartedBtn")
  ?.addEventListener("click", () => enterAuthView("register"));

// The reference design includes a process-watch affordance. Keep it visual-only
// for now so no existing backend or navigation behavior is changed.

/* Smooth-scroll for the in-page nav links */
document.querySelectorAll(".landing-nav-links a[href^='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

/* Light / dark theme toggle for the landing page */
const landingViewEl = document.getElementById("landingView");
const landingThemeToggle = document.getElementById("landingThemeToggle");

function applyLandingTheme(theme) {
  if (!landingViewEl) return;
  if (theme === "light") {
    landingViewEl.setAttribute("data-theme", "light");
  } else {
    landingViewEl.removeAttribute("data-theme");
  }
}

const savedLandingTheme = localStorage.getItem("landingTheme");
if (savedLandingTheme) {
  applyLandingTheme(savedLandingTheme);
}

landingThemeToggle?.addEventListener("click", () => {
  const isLight = landingViewEl?.getAttribute("data-theme") === "light";
  const nextTheme = isLight ? "dark" : "light";
  applyLandingTheme(nextTheme);
  localStorage.setItem("landingTheme", nextTheme);
});

/* Sticky nav shadow on scroll */
const landingNav = document.getElementById("landingNav");
if (landingNav) {
  window.addEventListener("scroll", () => {
    landingNav.classList.toggle("is-scrolled", window.scrollY > 12);
  });
}

/* Scroll reveal for anything marked data-reveal, staggered within its section */
const revealTargets = Array.from(document.querySelectorAll("[data-reveal]"));

if (revealTargets.length) {
  revealTargets.forEach((el, index) => {
    el.style.setProperty("--reveal-delay", `${(index % 6) * 70}ms`);
  });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }
}
