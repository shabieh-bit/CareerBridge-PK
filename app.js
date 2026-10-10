const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
        });
    });
}

const interestForm = document.querySelector("#interest-form");
const formResult = document.querySelector("#form-result");

if (interestForm && formResult) {
    const nextSteps = {
        guidance: "Start by listing 3 roles that interest you, then compare the skills each role requires.",
        skills: "Choose one practical skill to improve this week and set aside three focused learning sessions.",
        internship: "Create a shortlist of 5 internship targets and tailor your CV for the first one."
    };

    interestForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const formData = new FormData(interestForm);
        const name = formData.get("name").trim();
        const goal = formData.get("goal");

        formResult.textContent = `${name}, your suggested next step: ${nextSteps[goal]}`;
        formResult.classList.add("show");
    });
}

const filterButtons = document.querySelectorAll(".filter-btn");
const opportunityCards = document.querySelectorAll(".opportunity-card");

if (filterButtons.length && opportunityCards.length) {
    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            filterButtons.forEach((item) => item.classList.remove("active"));
            button.classList.add("active");

            const filter = button.dataset.filter;

            opportunityCards.forEach((card) => {
                const showCard = filter === "all" || card.dataset.category === filter;
                card.hidden = !showCard;
            });
        });
    });
}


// ==========================================================
// CareerBridge PK prototype flow
// Front-end demonstration using localStorage.
// ==========================================================

const cbpStorage = {
    get(key, fallback = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

const normalizeSkills = (value) =>
    String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

const profileForm = document.querySelector("#student-profile-form");

if (profileForm) {
    const savedProfile = cbpStorage.get("careerbridgeProfile", {});

    Object.entries(savedProfile).forEach(([key, value]) => {
        const field = profileForm.elements.namedItem(key);
        if (field && field.type !== "file") {
            field.value = value;
        }
    });

    profileForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const data = new FormData(profileForm);
        const cvInput = profileForm.elements.namedItem("cv");
        const profile = {
            degree: data.get("degree").trim(),
            semester: data.get("semester").trim(),
            city: data.get("city").trim(),
            interest: data.get("interest").trim(),
            skills: data.get("skills").trim(),
            cvName: cvInput && cvInput.files.length ? cvInput.files[0].name : ""
        };

        cbpStorage.set("careerbridgeProfile", profile);

        const result = document.querySelector("#profile-result");
        if (result) {
            result.textContent = "Profile saved. Opening the eligibility check...";
            result.classList.add("show");
        }

        window.setTimeout(() => {
            window.location.href = "eligibility-check.html";
        }, 450);
    });
}

const eligibilityForm = document.querySelector("#eligibility-form");
const profileSummary = document.querySelector("#profile-summary");

if (eligibilityForm) {
    const profile = cbpStorage.get("careerbridgeProfile");

    if (profileSummary) {
        if (profile) {
            profileSummary.innerHTML = `
                <strong>${profile.degree || "Student profile"}</strong>
                <p>${profile.city || "City not added"} · ${profile.interest || "Interest not added"}</p>
                <p><strong>Skills:</strong> ${profile.skills || "No skills added"}</p>
            `;
        } else {
            profileSummary.innerHTML = `
                <strong>No profile saved yet</strong>
                <p>Create your student profile before checking eligibility.</p>
            `;
        }
    }

    eligibilityForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const resultBox = document.querySelector("#eligibility-result");
        const profileData = cbpStorage.get("careerbridgeProfile");

        if (!profileData) {
            if (resultBox) {
                resultBox.textContent = "Please create your student profile first.";
                resultBox.classList.add("show");
            }
            return;
        }

        const data = new FormData(eligibilityForm);
        const profileSkills = normalizeSkills(profileData.skills);
        const requirements = normalizeSkills(data.get("requirements"));

        const profileSkillMap = new Map(
            profileSkills.map((skill) => [skill.toLowerCase(), skill])
        );

        const matched = requirements.filter((skill) =>
            profileSkillMap.has(skill.toLowerCase())
        );

        const missing = requirements.filter((skill) =>
            !profileSkillMap.has(skill.toLowerCase())
        );

        const percentage = requirements.length
            ? Math.round((matched.length / requirements.length) * 100)
            : 0;

        const job = {
            link: data.get("jobLink").trim(),
            title: data.get("jobTitle").trim(),
            location: data.get("jobLocation").trim(),
            requirements
        };

        cbpStorage.set("careerbridgeJob", job);
        cbpStorage.set("careerbridgeMatch", {
            matched,
            missing,
            percentage,
            total: requirements.length
        });

        if (resultBox) {
            resultBox.textContent = "Eligibility checked. Opening your match result...";
            resultBox.classList.add("show");
        }

        window.setTimeout(() => {
            window.location.href = "match-result.html";
        }, 450);
    });
}

const matchPercent = document.querySelector("#match-percent");

if (matchPercent) {
    const match = cbpStorage.get("careerbridgeMatch", {
        matched: [],
        missing: [],
        percentage: 0,
        total: 0
    });
    const job = cbpStorage.get("careerbridgeJob", {});
    const profile = cbpStorage.get("careerbridgeProfile", {});

    const matchedCount = match.matched.length;
    const percentage = Number(match.percentage) || 0;

    matchPercent.textContent = percentage;
    document.querySelector("#match-count").textContent =
        `${matchedCount} of ${match.total} requirements matched`;

    const badge = document.querySelector("#match-badge");
    if (badge) {
        badge.textContent =
            percentage >= 80 ? "High match" :
            percentage >= 60 ? "Good match" :
            "Needs preparation";
    }

    const circle = document.querySelector("#score-circle");
    if (circle) circle.textContent = `${percentage}%`;

    const fill = document.querySelector("#progress-fill");
    if (fill) fill.style.width = `${percentage}%`;

    const matchedWrap = document.querySelector("#matched-skills");
    if (matchedWrap) {
        matchedWrap.innerHTML = match.matched.length
            ? match.matched.map((skill) => `<span class="skill-chip">${skill}</span>`).join("")
            : '<span class="small">No required skills matched yet.</span>';
    }

    const missingWrap = document.querySelector("#missing-skills");
    if (missingWrap) {
        missingWrap.innerHTML = match.missing.length
            ? match.missing.map((skill) => `<span class="skill-chip missing">${skill}</span>`).join("")
            : '<span class="small">No missing skills identified.</span>';
    }

    const jobTitle = document.querySelector("#result-job-title");
    const jobMeta = document.querySelector("#result-job-meta");
    const jobLink = document.querySelector("#result-job-link");

    if (jobTitle) jobTitle.textContent = job.title || "Selected opportunity";
    if (jobMeta) {
        jobMeta.textContent = [
            job.location || "Location not added",
            profile.interest || "Career interest"
        ].join(" · ");
    }
    if (jobLink) {
        jobLink.href = job.link || "#";
        if (!job.link) {
            jobLink.removeAttribute("target");
        }
    }

    const saveButton = document.querySelector("#save-job-btn");
    const saveResult = document.querySelector("#save-result");

    if (saveButton) {
        saveButton.addEventListener("click", () => {
            const savedJobs = cbpStorage.get("careerbridgeSavedJobs", []);
            const duplicate = savedJobs.some((item) => item.link === job.link);

            if (!duplicate) {
                savedJobs.push({
                    ...job,
                    match: percentage,
                    savedAt: new Date().toISOString()
                });
                cbpStorage.set("careerbridgeSavedJobs", savedJobs);
            }

            if (saveResult) {
                saveResult.textContent = duplicate
                    ? "This job is already saved."
                    : "Job saved to this browser.";
                saveResult.classList.add("show");
            }
        });
    }
}

const recommendationTitle = document.querySelector("#recommendation-title");

if (recommendationTitle) {
    const match = cbpStorage.get("careerbridgeMatch", {
        missing: [],
        percentage: 0
    });
    const job = cbpStorage.get("careerbridgeJob", {});

    const percentage = Number(match.percentage) || 0;
    const firstMissing = match.missing && match.missing.length
        ? match.missing[0]
        : "No missing skill identified";

    const recommendationCopy = document.querySelector("#recommendation-copy");
    const skillToImprove = document.querySelector("#skill-to-improve");
    const learningTime = document.querySelector("#learning-time");
    const status = document.querySelector("#application-status");

    if (percentage >= 70) {
        recommendationTitle.textContent = "Apply now";
        recommendationCopy.textContent = match.missing.length
            ? `You match most requirements. Apply while improving ${firstMissing}.`
            : "You match the listed requirements. Prepare your application and apply.";
    } else if (percentage > 0) {
        recommendationTitle.textContent = "Build the missing skills first";
        recommendationCopy.textContent =
            `Strengthen ${firstMissing} and the other missing requirements before applying.`;
    } else {
        recommendationTitle.textContent = "Complete your eligibility check";
        recommendationCopy.textContent =
            "Go back to the eligibility check to generate your personalised action plan.";
    }

    if (skillToImprove) skillToImprove.textContent = firstMissing;
    if (learningTime) {
        learningTime.textContent = match.missing.length
            ? "Suggested starter learning block: about 6 focused hours."
            : "No immediate skill gap identified from this prototype match.";
    }

    const application = cbpStorage.get("careerbridgeApplication");
    if (status) {
        status.textContent = application?.status ||
            (percentage >= 70 ? "Ready to apply" : "Preparation recommended");
    }

    const applyButton = document.querySelector("#apply-track-btn");
    const confirmation = document.querySelector("#confirmation-panel");

    if (applyButton) {
        applyButton.addEventListener("click", () => {
            const applicationData = {
                title: job.title || "Selected opportunity",
                link: job.link || "",
                status: "Application tracked",
                updatedAt: new Date().toISOString()
            };

            cbpStorage.set("careerbridgeApplication", applicationData);

            if (status) status.textContent = applicationData.status;
            if (confirmation) confirmation.hidden = false;
        });
    }
}
