// =====================================================
// CONFIG
// =====================================================

// IMPORTANT:
// Change this if your backend runs on another port.

const API_URL =
    //"http://localhost:3000/api";
    "https://personal-apps-tw7j.onrender.com/api"


// =====================================================
// STATE
// =====================================================

let token =
    localStorage.getItem("token");

let user = null;

let categories = [];

let tracking = [];

let currentYear =
    new Date().getFullYear();

let currentMonth =
    new Date().getMonth();

let selectedCategoryId = null;

let editingCategoryId = null;

const pendingClicks = new Map();


// =====================================================
// DOM
// =====================================================

const authScreen =
    document.getElementById("authScreen");

const app =
    document.getElementById("app");


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    init
);


async function init() {

    console.log("App starting...");

    // Check whether a login token exists
    const savedToken = localStorage.getItem("token");

    console.log("Saved token:", savedToken);

    // No token = ALWAYS show login
    if (!savedToken) {

        token = null;
        user = null;

        showLogin();

        return;
    }

    // Token exists
    token = savedToken;

    try {

        const response = await api("/auth/me");

        console.log(
            "Auth verification:",
            response.status
        );

        // Token is invalid/expired
        if (!response.ok) {

            localStorage.removeItem("token");

            token = null;
            user = null;

            showLogin();

            return;
        }

        const data = await response.json();

        user = data.user;

        // Only NOW start the calendar
        await startApp();

    } catch (error) {

        console.error(
            "Authentication check failed:",
            error
        );

        // Don't show calendar if authentication
        // could not be verified
        localStorage.removeItem("token");

        token = null;
        user = null;

        showLogin();
    }
}


// =====================================================
// AUTH UI
// =====================================================

function showLogin() {

    authScreen.classList.remove(
        "hidden"
    );

    app.classList.add(
        "hidden"
    );

    document
        .getElementById("loginSection")
        .classList.remove("hidden");

    document
        .getElementById("signupSection")
        .classList.add("hidden");

}


function showSignup() {

    document
        .getElementById("loginSection")
        .classList.add("hidden");

    document
        .getElementById("signupSection")
        .classList.remove("hidden");

}


document
    .getElementById("showSignupBtn")
    .addEventListener(
        "click",
        showSignup
    );


document
    .getElementById("showLoginBtn")
    .addEventListener(
        "click",
        showLogin
    );


// =====================================================
// LOGIN
// =====================================================

document
    .getElementById("loginBtn")
    .addEventListener(
        "click",
        login
    );


async function login() {

    const email =
        document
            .getElementById("loginEmail")
            .value
            .trim();

    const password =
        document
            .getElementById("loginPassword")
            .value;


    const error =
        document.getElementById(
            "loginError"
        );


    error.textContent = "";


    if (!email || !password) {

        error.textContent =
            "Please enter email and password.";

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/auth/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            email,
                            password
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Invalid email or password"
            );

        }


        token =
            data.token;

        user =
            data.user;


        localStorage.setItem(
            "token",
            token
        );


        await startApp();

    }
    catch (err) {

        error.textContent =
            err.message;

    }

}


// =====================================================
// SIGNUP
// =====================================================

document
    .getElementById("signupBtn")
    .addEventListener(
        "click",
        signup
    );


async function signup() {

    const name =
        document
            .getElementById("signupName")
            .value
            .trim();

    const email =
        document
            .getElementById("signupEmail")
            .value
            .trim();

    const password =
        document
            .getElementById("signupPassword")
            .value;

    const confirmPassword =
        document
            .getElementById(
                "signupConfirmPassword"
            )
            .value;


    const error =
        document.getElementById(
            "signupError"
        );


    error.textContent = "";


    if (
        !name ||
        !email ||
        !password ||
        !confirmPassword
    ) {

        error.textContent =
            "Please fill all fields.";

        return;

    }


    if (password.length < 6) {

        error.textContent =
            "Password must be at least 6 characters.";

        return;

    }


    if (
        password !==
        confirmPassword
    ) {

        error.textContent =
            "Passwords do not match.";

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/auth/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            name,
                            email,
                            password
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Registration failed"
            );

        }


        token =
            data.token;

        user =
            data.user;


        localStorage.setItem(
            "token",
            token
        );


        await startApp();

    }
    catch (err) {

        error.textContent =
            err.message;

    }

}


// =====================================================
// START APP
// =====================================================

async function startApp() {

    authScreen.classList.add(
        "hidden"
    );

    app.classList.remove(
        "hidden"
    );


    document
        .getElementById(
            "welcomeUser"
        )
        .textContent =
        `Hi, ${user.name}`;


    loadLocalData();

    renderCalendar();


    if (navigator.onLine) {

        await downloadFromServer();

        if (
            categories.length > 0 ||
            tracking.length > 0
        ) {

            await sync();

        }

    }

}


// =====================================================
// LOCAL STORAGE
// =====================================================

function storageKey(name) {

    return `
        daily_tracker_${user.id}_${name}
    `;

}


function loadLocalData() {

    try {

        categories =
            JSON.parse(
                localStorage.getItem(
                    storageKey("categories")
                ) || "[]"
            );


        tracking =
            JSON.parse(
                localStorage.getItem(
                    storageKey("tracking")
                ) || "[]"
            );

    }
    catch {

        categories = [];

        tracking = [];

    }

}


function saveLocalData() {

    localStorage.setItem(
        storageKey("categories"),
        JSON.stringify(categories)
    );


    localStorage.setItem(
        storageKey("tracking"),
        JSON.stringify(tracking)
    );

}


// =====================================================
// API HELPER
// =====================================================

async function api(
    endpoint,
    options = {}
) {

    const headers = {

        ...(options.headers || {})

    };


    if (token) {

        headers.Authorization =
            `Bearer ${token}`;

    }


    return fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,
            headers
        }
    );

}


// =====================================================
// DOWNLOAD SERVER DATA
// =====================================================

async function downloadFromServer() {

    try {

        const response =
            await api("/data");


        if (!response.ok) {

            return;

        }


        const data =
            await response.json();


        categories =
            data.categories || [];


        tracking =
            data.tracking || [];


        saveLocalData();


        renderCalendar();

    }
    catch (error) {

        console.log(
            "Offline/server unavailable"
        );

    }

}


// =====================================================
// SYNC LOCAL → SERVER
// =====================================================

async function sync() {

    if (!navigator.onLine) {

        return;

    }


    try {

        const button =
            document.getElementById(
                "syncBtn"
            );


        button.disabled = true;

        button.textContent =
            "Syncing...";


        const response =
            await api(
                "/sync",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            categories,
                            tracking
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Sync failed"
            );

        }


        categories =
            data.categories ||
            categories;


        tracking =
            data.tracking ||
            tracking;


        saveLocalData();


        renderCalendar();

    }
    catch (error) {

        console.error(error);

    }
    finally {

        const button =
            document.getElementById(
                "syncBtn"
            );


        button.disabled = false;

        button.textContent =
            "↻ Sync";

    }

}


document
    .getElementById("syncBtn")
    .addEventListener(
        "click",
        sync
    );


// =====================================================
// ADD CATEGORY
// =====================================================

document
    .getElementById("addCategoryBtn")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "categoryModal"
                )
                .classList.remove(
                    "hidden"
                );

        }
    );


document
    .getElementById("closeCategoryModal")
    .addEventListener(
        "click",
        closeCategoryModal
    );


document
    .getElementById("cancelCategory")
    .addEventListener(
        "click",
        closeCategoryModal
    );


function closeCategoryModal() {

    document
        .getElementById(
            "categoryModal"
        )
        .classList.add(
            "hidden"
        );

}


document
    .getElementById("saveCategory")
    .addEventListener(
        "click",
        addCategory
    );


async function addCategory() {

    const input =
        document.getElementById(
            "categoryInput"
        );


    const name =
        input.value.trim();


    if (!name) {

        return;

    }


    const newCategory = {

        id:
            crypto.randomUUID(),

        user_id:
            user.id,

        name,

        created_at:
            new Date().toISOString(),

        updated_at:
            new Date().toISOString()

    };


    categories.push(newCategory);
    selectedCategoryId = newCategory.id;


    saveLocalData();


    input.value = "";


    closeCategoryModal();


    renderCalendar();


    showToast(
        "Category added"
    );


    if (navigator.onLine) {

        sync();

    }

}


// =====================================================
// EDIT CATEGORY
// =====================================================

function openEditCategory(id) {

    const category =
        categories.find(
            item =>
                item.id === id
        );


    if (!category) {

        return;

    }


    editingCategoryId =
        id;


    document
        .getElementById(
            "editCategoryInput"
        )
        .value =
        category.name;


    document
        .getElementById(
            "editCategoryModal"
        )
        .classList.remove(
            "hidden"
        );

}


document
    .getElementById(
        "closeEditModal"
    )
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "editCategoryModal"
                )
                .classList.add(
                    "hidden"
                );

        }
    );


// =====================================================
// UPDATE CATEGORY
// =====================================================

document
    .getElementById(
        "updateCategory"
    )
    .addEventListener(
        "click",
        async () => {

            const category =
                categories.find(
                    item =>
                        item.id ===
                        editingCategoryId
                );


            if (!category) {

                return;

            }


            const name =
                document
                    .getElementById(
                        "editCategoryInput"
                    )
                    .value
                    .trim();


            if (!name) {

                return;

            }


            category.name =
                name;

            category.updated_at =
                new Date().toISOString();


            saveLocalData();


            document
                .getElementById(
                    "editCategoryModal"
                )
                .classList.add(
                    "hidden"
                );


            renderCalendar();


            if (navigator.onLine) {

                sync();

            }

        }
    );


// =====================================================
// DELETE CATEGORY
// =====================================================

document
    .getElementById(
        "deleteCategory"
    )
    .addEventListener(
        "click",
        async () => {

            const category =
                categories.find(
                    item =>
                        item.id ===
                        editingCategoryId
                );


            if (!category) {

                return;

            }


            if (
                !confirm(
                    `Delete "${category.name}"?`
                )
            ) {

                return;

            }


            categories =
                categories.filter(
                    item =>
                        item.id !==
                        editingCategoryId
                );


            tracking =
                tracking.filter(
                    item =>
                        item.category_id !==
                        editingCategoryId
                );


            if (
                selectedCategoryId ===
                    editingCategoryId
            ) {

                selectedCategoryId =
                    categories[0]?.id || null;

            }


            saveLocalData();


            document
                .getElementById(
                    "editCategoryModal"
                )
                .classList.add(
                    "hidden"
                );


            renderCalendar();


            if (navigator.onLine) {

                sync();

            }

        }
    );


// =====================================================
// YEAR
// =====================================================

document
    .getElementById(
        "previousMonth"
    )
    .addEventListener(
        "click",
        () => {

            currentMonth--;

            if (currentMonth < 0) {

                currentMonth = 11;
                currentYear--;

            }

            renderCalendar();

        }
    );


document
    .getElementById(
        "nextMonth"
    )
    .addEventListener(
        "click",
        () => {

            currentMonth++;

            if (currentMonth > 11) {

                currentMonth = 0;
                currentYear++;

            }

            renderCalendar();

        }
    );


document
    .getElementById(
        "todayBtn"
    )
    .addEventListener(
        "click",
        () => {

            const today =
                new Date();

            currentYear =
                today.getFullYear();

            currentMonth =
                today.getMonth();

            renderCalendar();

        }
    );


document
    .getElementById(
        "monthSelect"
    )
    .addEventListener(
        "change",
        (event) => {

            currentMonth =
                Number(
                    event.target.value
                );

            renderCalendar();

        }
    );


document
    .getElementById(
        "yearInput"
    )
    .addEventListener(
        "change",
        (event) => {

            const nextYear =
                Number(
                    event.target.value
                );

            if (
                Number.isFinite(nextYear)
            ) {

                currentYear =
                    nextYear;

                renderCalendar();

            }

        }
    );


// =====================================================
// CALENDAR
// =====================================================

function ensureSelectedCategory() {

    if (categories.length === 0) {

        selectedCategoryId = null;
        return null;

    }


    const exists =
        categories.some(
            item =>
                item.id ===
                    selectedCategoryId
        );

    if (!exists) {

        selectedCategoryId =
            categories[0].id;

    }

    return categories.find(
        item =>
            item.id ===
                selectedCategoryId
    );

}


function renderCalendar() {

    const monthDisplay =
        document.getElementById(
            "monthDisplay"
        );

    const yearDisplay =
        document.getElementById(
            "yearDisplay"
        );

    const monthSelect =
        document.getElementById(
            "monthSelect"
        );

    const yearInput =
        document.getElementById(
            "yearInput"
        );

    monthDisplay.textContent =
        new Date(
            currentYear,
            currentMonth,
            1
        ).toLocaleString(
            "default",
            {
                month: "long"
            }
        );

    yearDisplay.textContent =
        String(currentYear);

    monthSelect.value =
        String(currentMonth);

    yearInput.value =
        String(currentYear);


    const calendar =
        document.getElementById(
            "calendar"
        );


    calendar.innerHTML = "";


    if (categories.length === 0) {

        calendar.innerHTML = `

            <div
                style="
                    padding:70px 20px;
                    text-align:center;
                    color:#888;
                "
            >

                <div
                    style="
                        font-size:35px;
                        margin-bottom:10px;
                    "
                >
                    ✓
                </div>

                <strong
                    style="
                        color:#222;
                        display:block;
                        margin-bottom:5px;
                    "
                >
                    No categories yet
                </strong>

                <small>
                    Add your first category
                    to start tracking.
                </small>

            </div>

        `;

        return;

    }


    const selectedCategory =
        ensureSelectedCategory();

    const tabs =
        document.createElement(
            "div"
        );

    tabs.className =
        "category-tabs";

    categories.forEach(
        category => {

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                `category-tab ${
                    category.id ===
                        selectedCategory.id
                        ? "active"
                        : ""
                }`;

            button.textContent =
                category.name;

            button.addEventListener(
                "click",
                () => {

                    selectedCategoryId =
                        category.id;
                    renderCalendar();

                }
            );

            tabs.appendChild(button);

        }
    );

    calendar.appendChild(tabs);
    calendar.appendChild(
        createCategoryCalendar(
            selectedCategory
        )
    );

}


// =====================================================
// CATEGORY CALENDAR
// =====================================================

function getCategoryAnalytics(
    categoryId
) {

    const entries =
        tracking.filter(
            item =>
                item.category_id ===
                    categoryId
                &&
                (
                    item.status ===
                        "done"
                    ||
                    item.status ===
                        "not-done"
                )
        );


    if (entries.length === 0) {

        return {
            bestStreak: 0,
            currentStreak: 0,
            doneCount: 0,
            notDoneCount: 0,
            completionRate: 0,
            trackedDays: 0
        };

    }


    const byDate =
        new Map(
            entries.map(
                entry =>
                    [entry.date, entry.status]
            )
        );

    const sortedDates =
        [...new Set(
            entries.map(
                entry =>
                    entry.date
            )
        )].sort();


    let bestStreak = 0;
    let streakRun = 0;

    const firstDate =
        new Date(
            `${sortedDates[0]}T00:00:00`
        );

    const lastDate =
        new Date(
            `${sortedDates[sortedDates.length - 1]}T00:00:00`
        );


    for (
        let cursor =
            new Date(firstDate);
        cursor <= lastDate;
        cursor.setDate(
            cursor.getDate() + 1
        )
    ) {

        const key =
            formatDate(
                cursor.getFullYear(),
                cursor.getMonth(),
                cursor.getDate()
            );

        if (byDate.get(key) === "done") {

            streakRun++;
            bestStreak =
                Math.max(
                    bestStreak,
                    streakRun
                );

        }
        else {

            streakRun = 0;

        }

    }


    let currentStreak = 0;
    const today =
        new Date();

    for (
        let cursor =
            new Date(today);
        ;
        cursor.setDate(
            cursor.getDate() - 1
        )
    ) {

        const key =
            formatDate(
                cursor.getFullYear(),
                cursor.getMonth(),
                cursor.getDate()
            );

        if (byDate.get(key) === "done") {

            currentStreak++;

        }
        else {

            break;

        }

    }


    const doneCount =
        entries.filter(
            item =>
                item.status === "done"
        ).length;

    const notDoneCount =
        entries.filter(
            item =>
                item.status === "not-done"
        ).length;

    const trackedDays =
        sortedDates.length;

    const totalSpanDays =
        Math.max(
            1,
            Math.floor(
                (lastDate - firstDate) /
                    (1000 * 60 * 60 * 24)
            ) + 1
        );

    const completionRate =
        Math.round(
            (doneCount / totalSpanDays) * 100
        );


    return {
        bestStreak,
        currentStreak,
        doneCount,
        notDoneCount,
        completionRate,
        trackedDays
    };

}


function createAnalyticsSummary(
    categoryId
) {

    const analytics =
        getCategoryAnalytics(
            categoryId
        );

    const summary =
        document.createElement(
            "div"
        );

    summary.className =
        "analytics-summary";

    const items = [
        {
            label: "Current",
            value: `${analytics.currentStreak}d`
        },
        {
            label: "Best",
            value: `${analytics.bestStreak}d`
        },
        {
            label: "Done",
            value: String(
                analytics.doneCount
            )
        },
        {
            label: "Rate",
            value: `${analytics.completionRate}%`
        }
    ];

    items.forEach(
        item => {

            const box =
                document.createElement(
                    "div"
                );

            box.className =
                "analytics-item";

            const label =
                document.createElement(
                    "span"
                );

            label.className =
                "analytics-label";

            label.textContent =
                item.label;

            const value =
                document.createElement(
                    "strong"
                );

            value.className =
                "analytics-value";

            value.textContent =
                item.value;

            box.appendChild(label);
            box.appendChild(value);
            summary.appendChild(box);

        }
    );

    return summary;

}


function createCategoryCalendar(
    category
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "category-card";


    const header =
        document.createElement(
            "div"
        );


    header.className =
        "category-header";


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "category-info";


    const name =
        document.createElement(
            "span"
        );


    name.className =
        "category-name";

    name.textContent =
        category.name;


    info.appendChild(name);


    const edit =
        document.createElement(
            "button"
        );


    edit.className =
        "category-edit-btn";

    edit.textContent =
        "Edit";


    edit.addEventListener(
        "click",
        () =>
            openEditCategory(
                category.id
            )
    );


    header.appendChild(info);
    header.appendChild(edit);


    wrapper.appendChild(header);
    wrapper.appendChild(
        createAnalyticsSummary(
            category.id
        )
    );


    const body =
        document.createElement(
            "div"
        );


    body.className =
        "category-calendar-body";


    const yearGrid =
        document.createElement(
            "div"
        );


    yearGrid.className =
        "calendar-month-grid";


    yearGrid.appendChild(
        createMonth(
            category,
            currentYear,
            currentMonth
        )
    );


    body.appendChild(yearGrid);
    wrapper.appendChild(body);


    return wrapper;

}


// =====================================================
// MONTH
// =====================================================

function createMonth(
    category,
    year,
    month
) {

    const monthElement =
        document.createElement(
            "div"
        );


    monthElement.className =
        "calendar-month";


    const date =
        new Date(
            year,
            month,
            1
        );


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "month-title";


    title.textContent =
        date.toLocaleString(
            "default",
            {
                month: "long"
            }
        );


    monthElement.appendChild(
        title
    );


    const weekdays =
        document.createElement(
            "div"
        );


    weekdays.className =
        "weekdays-row";


    [
        "S",
        "M",
        "T",
        "W",
        "T",
        "F",
        "S"
    ].forEach(
        day => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "weekday-col";

            item.textContent =
                day;

            weekdays.appendChild(
                item
            );

        }
    );


    monthElement.appendChild(
        weekdays
    );


    const days =
        document.createElement(
            "div"
        );


    days.className =
        "days-grid";


    const firstDay =
        date.getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "day-cell empty-pad";

        days.appendChild(
            empty
        );

    }


    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const cell =
            createDay(
                category,
                year,
                month,
                day
            );


        days.appendChild(
            cell
        );

    }


    monthElement.appendChild(
        days
    );


    return monthElement;

}


// =====================================================
// DAY
// =====================================================

function createDay(
    category,
    year,
    month,
    day
) {

    const cell =
        document.createElement(
            "div"
        );


    cell.className =
        "day-cell";


    const number =
        document.createElement(
            "span"
        );


    number.className =
        "day-num";

    number.textContent =
        day;


    cell.appendChild(
        number
    );


    const date =
        formatDate(
            year,
            month,
            day
        );


    const status =
        getStatus(
            category.id,
            date
        );


    if (status === "done") {

        cell.classList.add(
            "done"
        );

    }


    if (status === "not-done") {

        cell.classList.add(
            "not-done"
        );

    }


    const today =
        new Date();


    if (
        year ===
            today.getFullYear()
        &&
        month ===
            today.getMonth()
        &&
        day ===
            today.getDate()
    ) {

        cell.classList.add(
            "today"
        );

    }


    /*
        Single click toggles DONE / empty.
        Double click toggles NOT DONE / empty.
    */

    cell.addEventListener(
        "click",
        () => {

            if (
                pendingClicks.has(date)
            ) {

                clearTimeout(
                    pendingClicks.get(
                        date
                    )
                );

                pendingClicks.delete(
                    date
                );


                const currentStatus =
                    getStatus(
                        category.id,
                        date
                    );

                setStatus(
                    category.id,
                    date,
                    currentStatus === "not-done"
                        ? null
                        : "not-done"
                );


                return;

            }


            const timer =
                setTimeout(
                    () => {

                        pendingClicks.delete(
                            date
                        );


                        const currentStatus =
                            getStatus(
                                category.id,
                                date
                            );

                        setStatus(
                            category.id,
                            date,
                            currentStatus === "done"
                                ? null
                                : "done"
                        );

                    },
                    220
                );


            pendingClicks.set(
                date,
                timer
            );

        }
    );


    return cell;

}


// =====================================================
// GET STATUS
// =====================================================

function getStatus(
    categoryId,
    date
) {

    const item =
        tracking.find(
            entry =>
                entry.category_id ===
                    categoryId
                &&
                entry.date ===
                    date
        );


    return item
        ? item.status
        : null;

}


// =====================================================
// SET STATUS
// =====================================================

function setStatus(
    categoryId,
    date,
    status
) {

    const index =
        tracking.findIndex(
            entry =>
                entry.category_id ===
                    categoryId
                &&
                entry.date ===
                    date
        );


    if (
        status === null ||
        status === undefined ||
        status === ""
    ) {

        if (index >= 0) {

            tracking.splice(
                index,
                1
            );

        }


        saveLocalData();


        renderCalendar();


        if (navigator.onLine) {

            sync();

        }

        return;

    }


    const item = {

        id:
            index >= 0
                ? tracking[index].id
                : crypto.randomUUID(),

        user_id:
            user.id,

        category_id:
            categoryId,

        date,

        status,

        updated_at:
            new Date().toISOString()

    };


    if (index >= 0) {

        tracking[index] =
            item;

    }
    else {

        tracking.push(
            item
        );

    }


    saveLocalData();


    renderCalendar();


    /*
        If internet exists,
        sync immediately.

        If offline,
        localStorage keeps
        the change.
    */

    if (navigator.onLine) {

        sync();

    }

}


// =====================================================
// DATE
// =====================================================

function formatDate(
    year,
    month,
    day
) {

    return `${year}-${String(
        month + 1
    ).padStart(2, "0")}-${String(
        day
    ).padStart(2, "0")}`;

}


// =====================================================
// LOGOUT
// =====================================================

document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        () => logout(true)
    );


function logout(
    ask = true
) {

    if (
        ask &&
        !confirm(
            "Logout from Daily Tracker?"
        )
    ) {

        return;

    }


    token = null;

    user = null;

    categories = [];

    tracking = [];


    localStorage.removeItem(
        "token"
    );


    app.classList.add(
        "hidden"
    );

    authScreen.classList.remove(
        "hidden"
    );


    showLogin();

}


// =====================================================
// ONLINE / OFFLINE
// =====================================================

function updateOnlineStatus() {

    const element =
        document.getElementById(
            "onlineStatus"
        );


    if (navigator.onLine) {

        element.textContent =
            "● Online";

        element.classList.remove(
            "offline"
        );

    }
    else {

        element.textContent =
            "● Offline";

        element.classList.add(
            "offline"
        );

    }

}


window.addEventListener(
    "online",
    () => {

        updateOnlineStatus();

        showToast(
            "Back online"
        );


        sync();

    }
);


window.addEventListener(
    "offline",
    () => {

        updateOnlineStatus();

        showToast(
            "Offline mode"
        );

    }
);


updateOnlineStatus();


// =====================================================
// TOAST
// =====================================================

let toastTimer;


function showToast(
    message
) {

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2000
        );

}