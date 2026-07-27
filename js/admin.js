const adminForm = document.querySelector("[data-admin-form]");
const adminMessage = document.querySelector("[data-admin-message]");
const adminContent = document.querySelector("[data-admin-content]");
const adminCount = document.querySelector("[data-admin-count]");
const adminRows = document.querySelector("[data-admin-rows]");
const refreshButton = document.querySelector("[data-admin-refresh]");

let currentPassword = sessionStorage.getItem("rilogAdminPassword") || "";

const setAdminMessage = (message, tone = "neutral") => {
    adminMessage.textContent = message;
    adminMessage.dataset.tone = tone;
};

const formatDate = (value) => {
    if (!value) {
        return "-";
    }

    return new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
};

const renderRows = (entries) => {
    adminRows.innerHTML = "";

    if (!entries.length) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="2">아직 신청자가 없어요.</td>`;
        adminRows.appendChild(row);
        return;
    }

    entries.forEach((entry) => {
        const row = document.createElement("tr");
        const emailCell = document.createElement("td");
        const dateCell = document.createElement("td");

        emailCell.textContent = entry.email || "-";
        dateCell.textContent = formatDate(entry.createdAt);
        row.append(emailCell, dateCell);
        adminRows.appendChild(row);
    });
};

const loadWaitlist = async (password) => {
    setAdminMessage("명단을 불러오는 중이에요.");

    const response = await fetch("/api/waitlist", {
        headers: {
            "x-admin-password": password
        }
    });
    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.message || "명단을 불러오지 못했어요.");
    }

    sessionStorage.setItem("rilogAdminPassword", password);
    currentPassword = password;
    adminCount.textContent = payload.count.toLocaleString("ko-KR");
    renderRows(payload.entries || []);
    adminContent.hidden = false;
    setAdminMessage("명단을 불러왔어요.", "success");
};

adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(adminForm);
    const password = String(formData.get("password") || "");

    try {
        await loadWaitlist(password);
    } catch (error) {
        adminContent.hidden = true;
        setAdminMessage(error.message, "error");
    }
});

refreshButton.addEventListener("click", async () => {
    if (!currentPassword) {
        setAdminMessage("관리자 비밀번호를 먼저 입력해주세요.", "error");
        return;
    }

    try {
        await loadWaitlist(currentPassword);
    } catch (error) {
        setAdminMessage(error.message, "error");
    }
});

if (currentPassword) {
    document.querySelector("#admin-password").value = currentPassword;
    loadWaitlist(currentPassword).catch((error) => {
        adminContent.hidden = true;
        setAdminMessage(error.message, "error");
    });
}
