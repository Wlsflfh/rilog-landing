const sectionNavLinks = Array.from(document.querySelectorAll(".landing-section-nav .nav-link"));
const sectionTargets = sectionNavLinks
    .map((link) => {
        const target = document.querySelector(link.hash);
        return target ? { link, target } : null;
    })
    .filter(Boolean);

const setActiveSectionLink = (activeLink) => {
    sectionNavLinks.forEach((link) => {
        const isActive = link === activeLink;
        link.classList.toggle("is-active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "true");
            link.scrollIntoView({ block: "nearest", inline: "nearest" });
            return;
        }

        link.removeAttribute("aria-current");
    });
};

const updateActiveSection = () => {
    if (!sectionTargets.length) {
        return;
    }

    const headerHeight = document.querySelector(".landing-header")?.offsetHeight ?? 0;
    const activationLine = headerHeight + Math.min(window.innerHeight * 0.32, 260);
    let activeSection = sectionTargets[0];

    sectionTargets.forEach((section) => {
        if (section.target.getBoundingClientRect().top <= activationLine) {
            activeSection = section;
        }
    });

    setActiveSectionLink(activeSection.link);
};

let scrollFrame = null;
const requestActiveSectionUpdate = () => {
    if (scrollFrame !== null) {
        return;
    }

    scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        updateActiveSection();
    });
};

sectionNavLinks.forEach((link) => {
    link.addEventListener("click", () => setActiveSectionLink(link));
});

window.addEventListener("scroll", requestActiveSectionUpdate, { passive: true });
window.addEventListener("resize", requestActiveSectionUpdate);
window.addEventListener("load", updateActiveSection);
updateActiveSection();
