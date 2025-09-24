document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const countrySelect = document.getElementById('country-select');
    const holidayTypeSelect = document.getElementById('holiday-type-select');
    const viewMonthlyBtn = document.getElementById('view-monthly');
    const viewQuarterlyBtn = document.getElementById('view-quarterly');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const currentPeriodEl = document.getElementById('current-period');
    const calendarContainer = document.getElementById('calendar-container');
    const loadingEl = document.getElementById('loading');
    const controlsContainer = document.getElementById('controls-container');
    const apiErrorEl = document.getElementById('api-key-container'); // Get the container

    // --- State ---
    let state = {
        currentDate: new Date(),
        view: 'monthly',
        selectedCountry: 'IN', // Default to India
        selectedHolidayType: 'national',
        holidays: {}, // Cache: { "2025-IN": [...] }
    };

    // --- Backend API Base URL ---
    const APP_API_BASE_URL = '/api/v1/calendar';

    // --- API Functions (Talk to our Spring Boot backend) ---
    async function fetchWithRetry(url, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (response.ok) return response.json();
                throw new Error(`Server responded with status: ${response.status}`);
            } catch (error) {
                console.error(`Attempt ${i + 1} failed for URL ${url}:`, error);
                if (i < retries - 1) await new Promise(res => setTimeout(res, delay));
                else throw error;
            }
        }
    }

    async function getAvailableCountries() {
        try {
            const url = `${APP_API_BASE_URL}/countries`;
            const data = await fetchWithRetry(url);

            if (!data || !data.response || !data.response.countries) {
                throw new Error("Invalid country data format from server.");
            }

            const countries = data.response.countries;
            countries.sort((a, b) => a.country_name.localeCompare(b.country_name));

            countries.forEach(country => {
                const option = document.createElement('option');
                option.value = country['iso-3166'];
                option.textContent = country.country_name;
                countrySelect.appendChild(option);
            });
            countrySelect.value = state.selectedCountry;
            return true;
        } catch (error) {
            console.error("Failed to fetch countries from backend:", error);
            apiErrorEl.querySelector('#api-error').textContent = "Could not load country list. The backend might be down or the API key in application.properties is invalid.";
            apiErrorEl.classList.remove('hidden');
            return false;
        }
    }

    async function getHolidays(year, countryCode) {
        const cacheKey = `${year}-${countryCode}`;
        if (state.holidays[cacheKey]) {
            return state.holidays[cacheKey];
        }

        loadingEl.classList.remove('hidden');
        calendarContainer.classList.add('hidden');

        try {
            const url = `${APP_API_BASE_URL}/holidays?year=${year}&country=${countryCode}`;
            const data = await fetchWithRetry(url);

            if (!data || !data.response || !data.response.holidays) {
                 console.warn(`No holidays found for ${countryCode} in ${year}.`);
                 state.holidays[cacheKey] = [];
                 return [];
            }

            const holidaysData = data.response.holidays;
            state.holidays[cacheKey] = holidaysData;
            return holidaysData;
        } catch (error) {
            console.error(`Failed to fetch holidays for ${year} from backend:`, error);
            apiErrorEl.querySelector('#api-error').textContent = "Failed to load holiday data from the server.";
            apiErrorEl.classList.remove('hidden');
            return [];
        } finally {
            loadingEl.classList.add('hidden');
            calendarContainer.classList.remove('hidden');
        }
    }

    // --- Calendar Rendering ---
    function render() {
        updateCurrentPeriodDisplay();
        calendarContainer.innerHTML = '';

        if (state.view === 'monthly') {
            calendarContainer.className = 'grid grid-cols-1 gap-8';
            const month = state.currentDate.getMonth();
            const year = state.currentDate.getFullYear();
            renderMonth(year, month);
        } else { // quarterly
            calendarContainer.className = 'grid grid-cols-1 lg:grid-cols-3 gap-8';
            const currentMonth = state.currentDate.getMonth();
            const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
            const year = state.currentDate.getFullYear();
            for (let i = 0; i < 3; i++) {
                renderMonth(year, quarterStartMonth + i);
            }
        }
    }

    async function renderMonth(year, month) {
        const allHolidays = await getHolidays(year, state.selectedCountry);

        let filteredHolidays = [];
        if (allHolidays && allHolidays.length > 0) {
            if (state.selectedHolidayType === 'all') {
                filteredHolidays = allHolidays;
            } else {
                const typeKeyword = state.selectedHolidayType.replace('-', ' ');
                filteredHolidays = allHolidays.filter(h => h.type.some(t => t.toLowerCase().includes(typeKeyword)));
            }
        }

        const holidaysMap = new Map();
        if(filteredHolidays && filteredHolidays.length > 0) {
            filteredHolidays.forEach(h => {
                 const dateKey = `${h.date.datetime.year}-${String(h.date.datetime.month).padStart(2, '0')}-${String(h.date.datetime.day).padStart(2, '0')}`;
                 holidaysMap.set(dateKey, h.name);
            });
        }

        const monthContainer = document.createElement('div');
        monthContainer.className = 'bg-white rounded-xl shadow-md p-4';

        const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
        const monthHeader = `<h2 class="text-xl font-semibold text-center mb-4">${monthName} ${year}</h2>`;

        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const tableHead = `<thead><tr>${daysOfWeek.map(day => `<th class="text-xs text-gray-500 font-medium pb-2 text-left px-2">${day}</th>`).join('')}</tr></thead>`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let date = 1;
        let tableBody = '<tbody>';

        for (let i = 0; i < 6; i++) { // Force up to 6 weeks for consistent height
            let rowHtml = '';
            let weekHolidayCount = 0;
            let cellsInRow = 0;

            for (let j = 0; j < 7; j++) {
                if ((i === 0 && j < firstDay) || date > daysInMonth) {
                    rowHtml += '<td><div class="calendar-cell"></div></td>';
                } else {
                    cellsInRow++;
                    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    const holidayName = holidaysMap.get(currentDateStr);

                    let cellClasses = 'calendar-cell';
                    let dayContent;

                    if (holidayName) {
                        weekHolidayCount++;
                        cellClasses += ' day-holiday';
                        dayContent = `<div class="date-number">${date}</div><div class="holiday-name-inline">${holidayName}</div>`;
                    } else {
                        dayContent = `<div class="date-number">${date}</div>`;
                    }

                    rowHtml += `<td class="align-top border-t border-gray-200"><div class="${cellClasses}">${dayContent}</div></td>`;
                    date++;
                }
            }

            // Only add the row if it contains actual dates
            if (cellsInRow > 0) {
                 let weekClass = '';
                if (weekHolidayCount === 1) weekClass = 'week-one-holiday';
                if (weekHolidayCount > 1) weekClass = 'week-multi-holiday';
                tableBody += `<tr class="${weekClass}">${rowHtml}</tr>`;
            }

            if (date > daysInMonth) break; // Stop adding rows if month is finished
        }

        tableBody += '</tbody>';
        monthContainer.innerHTML = `${monthHeader}<table class="calendar-table">${tableHead}${tableBody}</table>`;
        calendarContainer.appendChild(monthContainer);
    }

    function updateCurrentPeriodDisplay() {
        const year = state.currentDate.getFullYear();
        if (state.view === 'monthly') {
            const monthName = state.currentDate.toLocaleString('default', { month: 'long' });
            currentPeriodEl.textContent = `${monthName} ${year}`;
        } else { // quarterly
            const month = state.currentDate.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            currentPeriodEl.textContent = `Q${quarter} ${year}`;
        }
    }

    // --- Event Handlers & Init ---
    function handleViewChange(newView) {
        state.view = newView;
        if (newView === 'monthly') {
            viewMonthlyBtn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
            viewMonthlyBtn.classList.remove('text-gray-600');
            viewQuarterlyBtn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
            viewQuarterlyBtn.classList.add('text-gray-600');
        } else {
            viewQuarterlyBtn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
            viewQuarterlyBtn.classList.remove('text-gray-600');
            viewMonthlyBtn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
            viewMonthlyBtn.classList.add('text-gray-600');
        }
        render();
    }

    function handleNav(direction) {
        const currentMonth = state.currentDate.getMonth();
        const currentYear = state.currentDate.getFullYear();

        if (state.view === 'monthly') {
            state.currentDate = new Date(currentYear, currentMonth + direction, 1);
        } else { // quarterly
            state.currentDate = new Date(currentYear, currentMonth + (direction * 3), 1);
        }
        render();
    }

    async function handleCountryChange(e) {
        state.selectedCountry = e.target.value;
        state.holidays = {}; // Clear holiday cache for new country
        render();
    }

    async function handleHolidayTypeChange(e) {
        state.selectedHolidayType = e.target.value;
        render();
    }

    async function startApp() {
        controlsContainer.classList.remove('hidden');
        const success = await getAvailableCountries();
        if (success) {
            render();
        }
    }

    function init() {
        countrySelect.addEventListener('change', handleCountryChange);
        holidayTypeSelect.addEventListener('change', handleHolidayTypeChange);
        viewMonthlyBtn.addEventListener('click', () => handleViewChange('monthly'));
        viewQuarterlyBtn.addEventListener('click', () => handleViewChange('quarterly'));
        prevBtn.addEventListener('click', () => handleNav(-1));
        nextBtn.addEventListener('click', () => handleNav(1));

        startApp();
    }

    init();
});