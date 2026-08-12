// MHC Check - Frontend Script

let SCRIPT_URL = localStorage.getItem('mhc_script_url') || 'https://script.google.com/macros/s/AKfycbx-3wEd5sq8JZUWI34AY0RTAaneOf3FB_7s6LmyLoLlJBdRrJMIo1EJRbNKh5oXvIc-Kw/exec';
let currentUser = null;
let classRooms = {};
let subjectsData = [];
let currentAttMode = '';

// Check setup on load
document.addEventListener('DOMContentLoaded', () => {
    if (!SCRIPT_URL) {
        document.getElementById('setup-screen').classList.remove('hidden');
    } else {
        document.getElementById('mng-api-url').value = SCRIPT_URL;
        const savedUser = sessionStorage.getItem('mhc_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showAppShell();
        }
    }
    
    // Set today's date in inputs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('att-date').value = today;
    document.getElementById('stat-date').value = today;
});

function saveApiUrl() {
    const url = document.getElementById('api-url-input').value.trim();
    if (!url) return Swal.fire('Error', 'กรุณาระบุ URL', 'error');
    
    SCRIPT_URL = url;
    localStorage.setItem('mhc_script_url', SCRIPT_URL);
    document.getElementById('mng-api-url').value = SCRIPT_URL;
    document.getElementById('setup-screen').classList.add('hidden');
    Swal.fire('Success', 'บันทึก URL เรียบร้อย', 'success');
}

// API Call Wrapper
async function callApi(action, payload = {}) {
    if (!SCRIPT_URL) {
        Swal.fire('Error', 'ไม่พบ API URL กรุณาตั้งค่าก่อน', 'error');
        return null;
    }
    
    document.getElementById('overlay-loader').classList.remove('hidden');
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } // text/plain to avoid CORS preflight in GAS
        });
        const result = await response.json();
        document.getElementById('overlay-loader').classList.add('hidden');
        return result;
    } catch (error) {
        document.getElementById('overlay-loader').classList.add('hidden');
        console.error('API Error:', error);
        Swal.fire('Error', 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้: ' + error.message, 'error');
        return null;
    }
}

// --- Login & Navigation ---

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!username || !password) return Swal.fire('Warning', 'กรุณากรอก Username และ Password', 'warning');
    
    const res = await callApi('login', { username, password });
    if (res && res.success) {
        currentUser = res.user;
        sessionStorage.setItem('mhc_user', JSON.stringify(currentUser));
        showAppShell();
    } else if (res) {
        Swal.fire('Error', res.message, 'error');
    }
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('mhc_user');
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-password').value = '';
}

function showAppShell() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    
    document.getElementById('user-info').innerText = currentUser.Name + (currentUser.Role === 'admin' ? ' (Admin)' : '');
    
    if (currentUser.Role === 'admin') {
        document.getElementById('nav-mng').classList.remove('hidden');
    } else {
        document.getElementById('nav-mng').classList.add('hidden');
    }
    
    showTab('home');
    loadDashboardStats();
    loadBaseData(); // class, rooms, subjects
}

function showTab(tabId) {
    document.querySelectorAll('main section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    
    document.querySelectorAll('.sidebar-link').forEach(btn => btn.classList.remove('active'));
    document.getElementById('nav-' + (tabId === 'summary' ? 'home' : tabId)).classList.add('active');
    
    if(window.innerWidth < 768) toggleSidebar();
    
    if (tabId === 'dailystat') {
        loadDailyStats();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

// --- Dashboard & Base Data ---

async function loadDashboardStats() {
    const res = await callApi('getStats');
    if (res && res.success) {
        document.getElementById('stat-students').innerText = res.stats.students;
        document.getElementById('stat-records').innerText = res.stats.records;
        document.getElementById('stat-subjects').innerText = res.stats.subjects;
        document.getElementById('stat-teachers').innerText = res.stats.teachers;
    }
}

async function loadBaseData() {
    const res = await callApi('getClassRoomOptions');
    if (res && res.success) {
        classRooms = res.data;
        updateClassDropdown();
    }
    
    const subRes = await callApi('getSubjects');
    if (subRes && subRes.success) {
        subjectsData = subRes.subjects;
        const subjSel = document.getElementById('att-subject');
        subjSel.innerHTML = '';
        subjectsData.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.SubjectCode;
            opt.text = `${s.SubjectCode} - ${s.SubjectName}`;
            subjSel.appendChild(opt);
        });
    }
}

function updateClassDropdown() {
    const sel = document.getElementById('att-class');
    sel.innerHTML = '';
    
    // Default to M.1 - M.6
    const defaultClasses = ['1', '2', '3', '4', '5', '6'];
    const availableClasses = Object.keys(classRooms).length > 0 ? Object.keys(classRooms).sort() : defaultClasses;
    
    // If we have no data, mock rooms so the UI works for testing
    if (Object.keys(classRooms).length === 0) {
        defaultClasses.forEach(c => { classRooms[c] = ['1', '2', '3', '4', '5']; });
    }
    
    availableClasses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.text = `ม.${c}`;
        sel.appendChild(opt);
    });
    
    onAttClassChange();
}

function onAttClassChange() {
    const c = document.getElementById('att-class').value;
    const roomSel = document.getElementById('att-room');
    roomSel.innerHTML = '';
    if (classRooms[c]) {
        classRooms[c].forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.text = `${c}/${r}`;
            roomSel.appendChild(opt);
        });
    }
}

// --- Attendance ---

function selectAttMode(mode) {
    currentAttMode = mode;
    document.getElementById('att-mode-select').classList.add('hidden');
    document.getElementById('att-form-area').classList.remove('hidden');
    document.getElementById('attendance-area').classList.add('hidden');
    
    if (mode === 'subject') {
        document.querySelectorAll('.subject-only').forEach(el => el.classList.remove('hidden'));
        document.getElementById('att-title').innerHTML = '<i class="fa-solid fa-book-open text-rose-500 mr-2"></i> บันทึกรายวิชา';
    } else {
        document.querySelectorAll('.subject-only').forEach(el => el.classList.add('hidden'));
        document.getElementById('att-title').innerHTML = '<i class="fa-solid fa-flag text-sky-500 mr-2"></i> บันทึกโฮมรูม';
    }
}

function backToAttMode() {
    document.getElementById('att-form-area').classList.add('hidden');
    document.getElementById('att-mode-select').classList.remove('hidden');
}

async function loadAttendanceList() {
    const className = document.getElementById('att-class').value;
    const room = document.getElementById('att-room').value;
    const date = document.getElementById('att-date').value;
    const subjectCode = document.getElementById('att-subject').value;
    
    if (!className || !room || !date) return Swal.fire('Warning', 'กรุณาระบุข้อมูลให้ครบถ้วน', 'warning');
    
    const payload = { type: currentAttMode, className, room, date, subjectCode };
    const res = await callApi('getAttendanceList', payload);
    
    if (res && res.success) {
        if (res.list.length === 0) {
            Swal.fire('Info', 'ไม่พบรายชื่อนักเรียนในห้องนี้', 'info');
            return;
        }
        
        let subText = currentAttMode === 'subject' ? `วิชา: ${subjectCode}` : 'โฮมรูม';
        document.getElementById('current-class-room').innerText = `ม.${className}/${room} | ${date} | ${subText}`;
        
        renderAttendanceList(res.list);
        document.getElementById('attendance-area').classList.remove('hidden');
        
        if (res.hasHistory) {
            Swal.fire('Info', 'โหลดประวัติการบันทึกที่มีอยู่แล้ว', 'info');
        }
    }
}

function renderAttendanceList(list) {
    const tbody = document.getElementById('attendance-list');
    tbody.innerHTML = '';
    
    list.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.dataset.id = item.studentId;
        
        // Status Radio html
        const statusHtml = `
            <div class="attendance-status">
                <label>
                    <input type="radio" name="st_${item.studentId}" value="มาเรียน" ${item.status === 'มาเรียน' || !item.status ? 'checked' : ''}>
                    <div class="lbl-p">มา</div>
                </label>
                <label>
                    <input type="radio" name="st_${item.studentId}" value="สาย" ${item.status === 'สาย' ? 'checked' : ''}>
                    <div class="lbl-s">สาย</div>
                </label>
                <label>
                    <input type="radio" name="st_${item.studentId}" value="ลา" ${item.status === 'ลา' ? 'checked' : ''}>
                    <div class="lbl-l">ลา</div>
                </label>
                <label>
                    <input type="radio" name="st_${item.studentId}" value="ขาด" ${item.status === 'ขาด' ? 'checked' : ''}>
                    <div class="lbl-a">ขาด</div>
                </label>
            </div>
        `;
        
        tr.innerHTML = `
            <td class="p-4 text-center">${item.number || index + 1}</td>
            <td class="p-4">${item.studentId}</td>
            <td class="p-4 font-medium">${item.name}</td>
            <td class="p-4">
                ${statusHtml}
                <span class="print-status-text">${item.status || 'ขาด'}</span>
            </td>
            <td class="p-4"><input type="text" class="glass-input note-input text-sm px-2 py-1" value="${item.note || ''}" placeholder="-"></td>
        `;
        
        // Add listener to update print-status-text
        tr.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                tr.querySelector('.print-status-text').innerText = e.target.value;
            });
        });
        
        tbody.appendChild(tr);
    });
}

function setAllAttendanceUI(status) {
    document.querySelectorAll('#attendance-list input[type="radio"]').forEach(radio => {
        if (radio.value === status) {
            radio.checked = true;
            // Also trigger change event for print status
            radio.dispatchEvent(new Event('change'));
        }
    });
}

async function submitAttendance() {
    const className = document.getElementById('att-class').value;
    const room = document.getElementById('att-room').value;
    const date = document.getElementById('att-date').value;
    const subjectCode = document.getElementById('att-subject').value;
    
    const records = [];
    document.querySelectorAll('#attendance-list tr').forEach(tr => {
        const studentId = tr.dataset.id;
        const status = tr.querySelector(`input[name="st_${studentId}"]:checked`)?.value || 'ขาด';
        const note = tr.querySelector('.note-input').value;
        records.push({ studentId, status, note });
    });
    
    if (records.length === 0) return;
    
    const payload = {
        type: currentAttMode,
        className,
        room,
        date,
        subjectCode: currentAttMode === 'subject' ? subjectCode : '',
        recorder: currentUser.Username,
        records
    };
    
    const res = await callApi('recordAttendance', payload);
    if (res && res.success) {
        Swal.fire('Success', res.message, 'success').then(() => {
            document.getElementById('attendance-area').classList.add('hidden');
            loadDashboardStats();
        });
    }
}

// --- Daily Stats ---
async function loadDailyStats() {
    const date = document.getElementById('stat-date').value;
    if (!date) return;
    
    const res = await callApi('getDailyStats', { date });
    if (res && res.success) {
        document.getElementById('ds-total').innerText = res.stats.total;
        document.getElementById('ds-present').innerText = res.stats.present;
        document.getElementById('ds-absent').innerText = res.stats.absent;
        document.getElementById('ds-late').innerText = res.stats.late;
        document.getElementById('ds-sick').innerText = res.stats.sick;
    }
}

// --- Setup System ---
async function setupDatabase() {
    const res = await callApi('setup');
    if (res && res.success) {
        Swal.fire('Success', 'สร้างฐานข้อมูลเรียบร้อยแล้ว (สามารถเข้าไปแก้ไขข้อมูลใน Google Sheets)', 'success');
    }
}
